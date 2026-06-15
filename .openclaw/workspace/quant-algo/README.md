# Quant-Algo

Event-driven quantitative trading system for crypto futures (Binance USDT-M), featuring a 4-layer OCS signal engine, Bayesian risk management, HMM regime detection, and López de Prado CPCV validation.

## Architecture

```
MarketData → EventBus → DataLayer → EventBus → StrategyLayer → EventBus → ExecutionLayer
                                                                                │
                                                                          StateManager
```

**Core pipeline** runs identically in backtest, paper, and live modes — only the `DataFeed` and `ExecutionAdapter` differ.

| Layer | Responsibility |
|---|---|
| **EventDrivenRuntime** | Orchestrator: lifecycle, health checks, graceful shutdown, alert routing |
| **DataLayer** | Market data ingestion via injectable `DataFeed` (live or historical) |
| **StrategyLayer** | Signal generation: OCS 4-layer engine + OrderFlow + MultiTimeframe + IC-weighted fusion |
| **ExecutionLayer** | Order routing via injectable `ExecutionAdapter`, HMM regime scaling, tail risk, Kelly sizing |

### OCS Signal Engine (4 Layers)

| Layer | Function | Key Algorithms |
|---|---|---|
| L1 | Time-series processing | Ehlers AMA, VPM, Supertrend + Stochastics, Gaussian Structure |
| L2 | Adaptive signal filtering | Ehlers Dominant Cycle, LMS filter, Z-Score confidence, CVD divergence |
| L3 | ML classification | KNN-3D (price position / volume elasticity / cycle phase), Triple Barrier labels |
| L4 | Virtual trade simulation | Pyramid take-profit (TP1/TP2/TP3), dynamic stop-loss |

### Risk Management Stack

```
RiskManager (daily limits, cooldown)
  → BayesianKelly (position sizing, 1/4 Kelly)
    → HMM RegimeDetector (3-state: LOW_VOL / HIGH_VOL / CRISIS)
      → TailRiskModel (Cornish-Fisher VaR, CVaR)
        → TradingCostModel (Almgren-Chriss market impact)
          → CircuitBreaker (exchange API fault isolation)
            → KillSwitch (global emergency halt)
```

### Backtest Validation

- **CPCV** — Combinatorial Purged Cross-Validation with embargo
- **PBO** — Probability of Backtest Overfitting
- **DSR** — Deflated Sharpe Ratio (Bailey & López de Prado)
- **Walk-Forward** — Anchored/rolling window validation

## Quick Start

### Prerequisites

- **Node.js** >= 20.0.0
- **Redis** (for EventBus and KillSwitch persistence)
- **Binance API keys** (for paper/live trading)

### Installation

```bash
npm install
```

### Configuration

Copy the environment template and fill in your keys:

```bash
cp config/.env.example config/.env
```

**Required environment variables:**

| Variable | Description | Default |
|---|---|---|
| `BINANCE_API_KEY` | Binance API key | — |
| `BINANCE_SECRET` | Binance API secret | — |
| `BINANCE_SANDBOX` | Use testnet (`true`/`false`) | `true` |
| `TRADING_MODE` | `backtest` / `paper` / `live` | `live` |
| `TIMEFRAME` | Candle interval (`1m`/`5m`/`15m`/`1h`) | `5m` |
| `LEVERAGE` | Trading leverage | `50` |
| `REDIS_HOST` | Redis server host | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |

**Optional:**

| Variable | Description | Default |
|---|---|---|
| `REDIS_PASSWORD` | Redis auth password | — |
| `METRICS_ENABLED` | Enable Prometheus metrics | `true` |
| `METRICS_PORT` | Metrics server port | `9090` |
| `ENABLE_TRACING` | Enable OpenTelemetry tracing | `false` |
| `CHECK_INTERVAL` | Trading loop interval (seconds) | `30` |

### Run

```bash
# Type check
npm run build

# Paper trading (live market data, simulated execution)
npm run start:paper

# Live trading on testnet (default)
npm start

# Live trading on mainnet (real orders — use with caution)
BINANCE_SANDBOX=false npm run start:live
```

## Backtesting

### Method 1: Standalone Engine (fast iteration)

```bash
# 1. Prepare data — place OHLCV JSON in backtest-cache/
mkdir -p backtest-cache
# File naming: backtest-cache/{SYMBOL}-{TIMEFRAME}-{START}-{END}.json
# Format: [{ "timestamp": 1740000000000, "open": 2650.5, "high": 2655.0, "low": 2648.0, "close": 2653.2, "volume": 1234.56 }, ...]

# 2. (Optional) Edit config in backtest-engine.ts main()

# 3. Run
npm run backtest
```

**Output:**
- Console summary: trades, win rate, Sharpe, max drawdown, CAGR, GT Score
- JSON report: `backtest-reports/ocs-backtest-{timestamp}.json`

### Method 2: Runtime Backtest (full pipeline)

Uses the same event-driven pipeline as live trading, with `HistoricalDataFeed` + `PaperExecutionAdapter`:

```typescript
import { EventDrivenRuntime } from './src/runtime';
import { HistoricalDataFeed } from './src/feeds/HistoricalDataFeed';
import { PaperExecutionAdapter } from './src/feeds/PaperExecutionAdapter';
// ... set up eventBus, layers, stateManager ...

const dataFeed = new HistoricalDataFeed({ ohlcv, batchSize: 1 });
const executionAdapter = new PaperExecutionAdapter({
  initialBalance: 10000,
  feeRate: 0.0006,
  slippageBps: 1,
});

const runtime = new EventDrivenRuntime(deps, {
  mode: 'backtest',
  dataFeed,
  executionAdapter,
});

await runtime.start();
```

### Method 3: Statistical Validation (CPCV + DSR)

After any backtest, validate results are not overfitting:

```typescript
import { validateBacktest } from './src/backtest/cpcvValidation';

const result = validateBacktest(equityCurve, {
  nGroups: 10,
  nTestGroups: 2,
  embargo: 0.01,
});

console.log('PBO:', result.pbo);            // Overfitting probability (lower = better)
console.log('DSR:', result.deflatedSharpe);  // Multiple-testing corrected Sharpe
console.log('MinBTL:', result.minBTL);       // Minimum backtest length required
```

## Testing

```bash
npm test                 # Run all tests (130 tests, 7 suites)
npm run test:watch       # Watch mode
npm run test:coverage    # With V8 coverage report
npm run test:ci          # CI mode (JUnit XML output)
```

| Suite | Tests | Scope |
|---|---|---|
| `state/StateStore` | 27 | State persistence, KV operations |
| `state/WALManager` | 17 | Write-ahead log, crash recovery |
| `risk/riskManager` | 24 | Position sizing, SL/TP, daily limits |
| `backtest/cpcvValidation` | 19 | CPCV, PBO, walk-forward |
| `signal/signalFusion` | 15 | IC tracking, signal weighting |
| `safety/CircuitBreaker` | 15 | Fault isolation, state transitions |
| `safety/KillSwitch` | 13 | Emergency halt, persistence |

## Project Structure

```
quant-algo/
├── backtest-engine.ts          # Standalone backtest entry point
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── config/
│   ├── .env                    # Your config (git-ignored)
│   └── .env.example            # Template
├── src/
│   ├── index.ts                # Library entry + system factory
│   ├── config.ts               # Unified configuration (env + risk JSON)
│   ├── exchange.ts             # Binance API (testnet/mainnet dynamic switch)
│   ├── riskManager.ts          # Daily risk management
│   ├── runtime/                # EventDrivenRuntime orchestrator
│   ├── layers/                 # Data / Strategy / Execution layers
│   ├── events/                 # EventBus (Redis Streams + Pub/Sub)
│   ├── ocs/                    # OCS 4-layer signal engine
│   │   └── enhanced/           # v312 enhancements (Gaussian, CVD)
│   ├── risk/                   # BayesianKelly, HMM, TailRisk, TradingCost
│   ├── feeds/                  # DataFeed / ExecutionAdapter abstractions
│   ├── state/                  # WAL + Snapshot state persistence
│   ├── safety/                 # CircuitBreaker + KillSwitch
│   ├── signals/                # OrderFlow, MultiTimeframe
│   ├── indicators/             # RSI (Wilder), barrel exports
│   ├── backtest/               # CPCV, DSR, TripleBarrier, LeakageControlled
│   ├── modules/                # TechnicalAnalysis, SignalFusion, StrategyEngine
│   ├── monitoring/             # AlertManager, Metrics, Dashboard, Tracing
│   ├── execution/              # TradingBot, OrderGenerator, OrderTypes
│   ├── agents/                 # MarketIntelligence, CentralTradingAgent
│   ├── optimization/           # Adaptive-OPRO, FeedbackLoop
│   ├── ml/                     # ML utilities
│   ├── ai/                     # AI/LLM integration
│   └── factors/                # Factor library
├── tests/
│   ├── helpers/                # Shared test fixtures (mockConfig.ts)
│   ├── backtest/
│   ├── risk/
│   ├── safety/
│   ├── signal/
│   └── state/
├── backtest-cache/             # OHLCV data cache (git-ignored)
└── backtest-reports/           # Generated reports (git-ignored)
```

## Trading Modes

| Mode | DataFeed | ExecutionAdapter | Use Case |
|---|---|---|---|
| `backtest` | `HistoricalDataFeed` (replay) | `PaperExecutionAdapter` (simulated) | Strategy development |
| `paper` | `LiveDataFeed` (real-time) | `PaperExecutionAdapter` (simulated) | Pre-production validation |
| `live` | `LiveDataFeed` (real-time) | `LiveExecutionAdapter` → Binance API | Production trading |

Switching modes requires **zero code changes** — only the injected adapters differ.

## Key Technical Decisions

- **Wilder's RSI** (exponential smoothing, not SMA/Cutler variant)
- **Cornish-Fisher VaR** with left-tail z-value for proper risk estimation
- **Bailey & López de Prado DSR** with correct kurtosis term `(γ₄ + 2) / 4`
- **Abramowitz & Stegun normal CDF** (Formula 26.2.17) with `z/√2` transformation
- **Anti-lookahead bias** in KNN training via offset parameter and Triple Barrier labeling
- **1/4 Kelly** conservative position sizing with Beta posterior
- **3-state HMM** (Baum-Welch + Viterbi) for regime-aware position scaling
