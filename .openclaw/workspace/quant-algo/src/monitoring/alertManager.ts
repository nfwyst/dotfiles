/**
 * Alert Manager — Production Monitoring
 * Evaluates metrics and triggers alerts via configured channels.
 *
 * FIX BUG 7: Added cleanup of expired cooldown entries in evaluate()
 * to prevent unbounded growth of the lastAlertTime map. Also ensured
 * maxAlertsPerHour is properly enforced with correct hour-boundary reset.
 */

// ────────────────────────────────────────────────────────────────
// Types & Enums
// ────────────────────────────────────────────────────────────────

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum AlertChannel {
  LOG = 'log',
  WEBHOOK = 'webhook',
  TELEGRAM = 'telegram',
}

export interface AlertRule {
  name: string;
  condition: (metrics: Record<string, number>) => boolean;
  severity: AlertSeverity;
  message: string;
  cooldownMs: number; // minimum time between alerts
}

export interface Alert {
  id: string;
  rule: string;
  severity: AlertSeverity;
  message: string;
  timestamp: number;
  metrics: Record<string, number>;
}

export interface AlertConfig {
  channels: AlertChannel[];
  webhookUrl?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  maxAlertsPerHour: number; // default: 20
}

// ────────────────────────────────────────────────────────────────
// Alert Manager
// ────────────────────────────────────────────────────────────────

/** How often (in evaluate() calls) to run cooldown map cleanup */
const COOLDOWN_CLEANUP_INTERVAL = 50;

export class AlertManager {
  private config: AlertConfig;
  private rules: AlertRule[] = [];
  private alertHistory: Alert[] = [];
  private lastAlertTime: Map<string, number> = new Map();
  private alertCountThisHour: number = 0;
  private hourResetTime: number = Date.now();

  // FIX BUG 7: Counter to throttle cooldown cleanup — we don't need to
  // scan the map on every single evaluate() call.
  private evaluateCallCount: number = 0;

  constructor(config?: Partial<AlertConfig>) {
    this.config = {
      channels: config?.channels ?? [AlertChannel.LOG],
      webhookUrl: config?.webhookUrl,
      telegramBotToken: config?.telegramBotToken,
      telegramChatId: config?.telegramChatId,
      maxAlertsPerHour: config?.maxAlertsPerHour ?? 20,
    };
  }

  /**
   * Register default trading alerts.
   * These cover the most common production monitoring scenarios.
   */
  registerDefaultRules(): void {
    const defaults: AlertRule[] = [
      // ── Drawdown alerts ─────────────────────────────────────
      {
        name: 'drawdown_warning',
        condition: (m) => (m['drawdown_pct'] ?? 0) > 5,
        severity: AlertSeverity.WARNING,
        message: 'Drawdown exceeds 5% — consider reducing position size',
        cooldownMs: 5 * 60 * 1000, // 5 minutes
      },
      {
        name: 'drawdown_critical',
        condition: (m) => (m['drawdown_pct'] ?? 0) > 10,
        severity: AlertSeverity.CRITICAL,
        message: 'CRITICAL: Drawdown exceeds 10% — review strategy immediately',
        cooldownMs: 2 * 60 * 1000, // 2 minutes
      },

      // ── Position holding time ───────────────────────────────
      {
        name: 'long_hold_warning',
        condition: (m) => (m['position_hold_hours'] ?? 0) > 24,
        severity: AlertSeverity.WARNING,
        message: 'Position held for more than 24 hours — check for stuck state',
        cooldownMs: 60 * 60 * 1000, // 1 hour
      },

      // ── Consecutive losses ──────────────────────────────────
      {
        name: 'consecutive_losses_warning',
        condition: (m) => (m['consecutive_losses'] ?? 0) >= 3,
        severity: AlertSeverity.WARNING,
        message: '3 consecutive losses detected — strategy may be in adverse regime',
        cooldownMs: 30 * 60 * 1000, // 30 minutes
      },
      {
        name: 'consecutive_losses_critical',
        condition: (m) => (m['consecutive_losses'] ?? 0) >= 5,
        severity: AlertSeverity.CRITICAL,
        message: 'CRITICAL: 5 consecutive losses — consider halting trading',
        cooldownMs: 15 * 60 * 1000, // 15 minutes
      },

      // ── Balance depletion ───────────────────────────────────
      {
        name: 'balance_critical',
        condition: (m) => {
          const initial = m['initial_balance'] ?? 0;
          const current = m['current_balance'] ?? 0;
          return initial > 0 && current < initial * 0.5;
        },
        severity: AlertSeverity.CRITICAL,
        message: 'CRITICAL: Balance below 50% of initial — kill switch recommended',
        cooldownMs: 5 * 60 * 1000, // 5 minutes
      },

      // ── System health ───────────────────────────────────────
      {
        name: 'no_trades_warning',
        condition: (m) => {
          const lastTradeAge = m['last_trade_age_hours'] ?? 0;
          return lastTradeAge > 24;
        },
        severity: AlertSeverity.WARNING,
        message: 'No trades in 24 hours — system may be stuck or market conditions unfavorable',
        cooldownMs: 6 * 60 * 60 * 1000, // 6 hours
      },
      {
        name: 'high_latency_warning',
        condition: (m) => (m['latency_seconds'] ?? 0) > 5,
        severity: AlertSeverity.WARNING,
        message: 'High latency detected (>5s) — execution quality degraded',
        cooldownMs: 5 * 60 * 1000, // 5 minutes
      },
      {
        name: 'kill_switch_critical',
        condition: (m) => (m['kill_switch_active'] ?? 0) === 1,
        severity: AlertSeverity.CRITICAL,
        message: 'CRITICAL: Kill switch has been triggered — all trading halted',
        cooldownMs: 60 * 1000, // 1 minute
      },
    ];

    for (const rule of defaults) {
      this.addRule(rule);
    }
  }

  /** Register custom alert rule */
  addRule(rule: AlertRule): void {
    // Avoid duplicate rule names
    const existing = this.rules.findIndex((r) => r.name === rule.name);
    if (existing >= 0) {
      this.rules[existing] = rule;
    } else {
      this.rules.push(rule);
    }
  }

  /**
   * Evaluate all rules against current metrics.
   * Returns an array of triggered alerts (respecting cooldowns and rate limits).
   *
   * FIX BUG 7: Now periodically cleans up expired entries from the
   * lastAlertTime map to prevent unbounded memory growth. Also properly
   * enforces maxAlertsPerHour with a rolling hour window.
   */
  evaluate(metrics: Record<string, number>): Alert[] {
    const now = Date.now();
    const triggered: Alert[] = [];

    // Reset hourly counter if needed
    if (now - this.hourResetTime >= 60 * 60 * 1000) {
      this.alertCountThisHour = 0;
      this.hourResetTime = now;
    }

    // FIX BUG 7: Periodically clean up expired cooldown entries.
    // We do this every COOLDOWN_CLEANUP_INTERVAL evaluate() calls
    // to avoid scanning the map on every single call.
    this.evaluateCallCount++;
    if (this.evaluateCallCount >= COOLDOWN_CLEANUP_INTERVAL) {
      this.evaluateCallCount = 0;
      this.cleanupExpiredCooldowns(now);
    }

    for (const rule of this.rules) {
      // Check rate limit
      if (this.alertCountThisHour >= this.config.maxAlertsPerHour) {
        break;
      }

      // Check cooldown for this specific rule
      const lastTime = this.lastAlertTime.get(rule.name) ?? 0;
      if (now - lastTime < rule.cooldownMs) {
        continue;
      }

      // Evaluate rule condition
      let conditionMet = false;
      try {
        conditionMet = rule.condition(metrics);
      } catch {
        // If the condition function throws, skip this rule
        continue;
      }

      if (!conditionMet) continue;

      // Create alert
      const alert: Alert = {
        id: `${rule.name}_${now}_${Math.random().toString(36).slice(2, 8)}`,
        rule: rule.name,
        severity: rule.severity,
        message: rule.message,
        timestamp: now,
        metrics: { ...metrics },
      };

      // Record alert
      this.alertHistory.push(alert);
      this.lastAlertTime.set(rule.name, now);
      this.alertCountThisHour++;
      triggered.push(alert);

      // Send alert asynchronously (fire and forget)
      this.sendAlert(alert).catch(() => {
        // Swallow send errors — alerting should never crash the system
      });
    }

    // Trim alert history to prevent memory growth (keep last 1000)
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }

    return triggered;
  }

  /**
   * FIX BUG 7: Remove expired cooldown entries from the lastAlertTime map.
   *
   * An entry is "expired" if its cooldown period has fully elapsed AND the
   * rule name is still registered. Entries for rules that have been removed
   * are always cleaned up (they're orphaned).
   *
   * This prevents the map from growing unboundedly when rules are dynamically
   * added and removed over a long-running process.
   */
  private cleanupExpiredCooldowns(now: number): void {
    // Build a set of current rule names for O(1) lookup
    const activeRuleNames = new Set(this.rules.map((r) => r.name));

    // Find the maximum cooldown among all active rules. We use this as
    // a conservative threshold: if an entry is older than maxCooldown,
    // its cooldown has certainly expired regardless of which rule it
    // belongs to.
    let maxCooldownMs = 0;
    for (const rule of this.rules) {
      if (rule.cooldownMs > maxCooldownMs) {
        maxCooldownMs = rule.cooldownMs;
      }
    }

    // Iterate and delete stale entries
    for (const [ruleName, lastTime] of this.lastAlertTime) {
      // Case 1: Rule no longer exists — orphaned entry, always remove
      if (!activeRuleNames.has(ruleName)) {
        this.lastAlertTime.delete(ruleName);
        continue;
      }

      // Case 2: Entry is older than the max cooldown — certainly expired
      if (now - lastTime > maxCooldownMs) {
        this.lastAlertTime.delete(ruleName);
      }
    }
  }

  /**
   * Send alert via configured channels.
   */
  private async sendAlert(alert: Alert): Promise<void> {
    for (const channel of this.config.channels) {
      switch (channel) {
        case AlertChannel.LOG:
          this.logAlert(alert);
          break;

        case AlertChannel.WEBHOOK:
          if (this.config.webhookUrl) {
            await this.sendWebhook(alert);
          }
          break;

        case AlertChannel.TELEGRAM:
          if (this.config.telegramBotToken && this.config.telegramChatId) {
            await this.sendTelegram(alert);
          }
          break;
      }
    }
  }

  /**
   * Log alert to console/stdout.
   */
  private logAlert(alert: Alert): void {
    const prefix =
      alert.severity === AlertSeverity.CRITICAL
        ? '🚨 CRITICAL'
        : alert.severity === AlertSeverity.WARNING
          ? '⚠️  WARNING'
          : 'ℹ️  INFO';

    const timestamp = new Date(alert.timestamp).toISOString();
    console.log(
      `[${timestamp}] ${prefix} [${alert.rule}]: ${alert.message}`,
    );
  }

  /**
   * Send alert via webhook (generic HTTP POST).
   */
  private async sendWebhook(alert: Alert): Promise<void> {
    if (!this.config.webhookUrl) return;

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `[${alert.severity.toUpperCase()}] ${alert.rule}: ${alert.message}`,
          severity: alert.severity,
          rule: alert.rule,
          timestamp: alert.timestamp,
          metrics: alert.metrics,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        console.error(
          `AlertManager: Webhook failed with status ${response.status}`,
        );
      }
    } catch (err) {
      console.error(`AlertManager: Webhook send error:`, err);
    }
  }

  /**
   * Send alert via Telegram Bot API.
   */
  private async sendTelegram(alert: Alert): Promise<void> {
    if (!this.config.telegramBotToken || !this.config.telegramChatId) return;

    const emoji =
      alert.severity === AlertSeverity.CRITICAL
        ? '🚨'
        : alert.severity === AlertSeverity.WARNING
          ? '⚠️'
          : 'ℹ️';

    const text = `${emoji} *${alert.severity.toUpperCase()}*\n\n` +
      `*Rule:* ${alert.rule}\n` +
      `*Message:* ${alert.message}\n` +
      `*Time:* ${new Date(alert.timestamp).toISOString()}`;

    const url = `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.config.telegramChatId,
          text,
          parse_mode: 'Markdown',
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        console.error(
          `AlertManager: Telegram send failed with status ${response.status}`,
        );
      }
    } catch (err) {
      console.error(`AlertManager: Telegram send error:`, err);
    }
  }

  /** Get recent alerts, optionally filtered by a start timestamp */
  getRecentAlerts(since?: number): Alert[] {
    if (since === undefined) {
      return [...this.alertHistory];
    }
    return this.alertHistory.filter((a) => a.timestamp >= since);
  }
}
