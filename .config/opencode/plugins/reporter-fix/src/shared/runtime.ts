import path from 'path';
import { loadReporterConfig, type ReporterConfig } from './config.ts';
import { createDebugLogger, type DebugLogger } from './debug.ts';
import { EMPTY_GIT_CONTEXT, resolveGitContext, type GitContext } from './git.ts';
import { logError } from './log.ts';
import { TelemetryReporter, type TelemetryRecord } from './reporter.ts';
import { readNonEmptyString } from './value.ts';

export interface TelemetryHookContext {
  toolName: string;
  sessionId: string;
  callId: string;
}

export interface InitializedHookRuntime {
  config: ReporterConfig;
  debugLogger: DebugLogger;
}

interface InitializeHookRuntimeInput {
  configPath?: string;
  source: string;
  worktree: string;
  configLoadedStep: string;
}

interface FinalizeTelemetryHookInput {
  config: ReporterConfig;
  debugLogger: DebugLogger;
  worktree: string;
  changes: { filePath: string }[];
  recordsStep: string;
  buildRecords: (gitContext: GitContext) => TelemetryRecord[];
  recordsData?: Record<string, unknown>;
  onReportError?: (error: unknown, debugLogger: DebugLogger) => Promise<TelemetryRecord[]>;
}

export function readTelemetryHookContext(
  payload: Record<string, unknown>,
  eventName: string
): TelemetryHookContext | undefined {
  if (payload.hook_event_name !== eventName) {
    return undefined;
  }

  const toolName: string | undefined = readNonEmptyString(payload.tool_name);
  const sessionId: string | undefined = readNonEmptyString(payload.session_id);
  const callId: string | undefined = readNonEmptyString(payload.tool_use_id);
  if (!toolName || !sessionId || !callId) {
    return undefined;
  }

  return {
    toolName,
    sessionId,
    callId,
  };
}

export async function loadEnabledReporterConfig(
  configPath?: string
): Promise<ReporterConfig | undefined> {
  const config = await loadReporterConfig(configPath).catch((error) => {
    const message: string = error instanceof Error ? error.message : String(error);
    logError(message);
    return undefined;
  });

  return config?.enabled ? config : undefined;
}

export async function initializeHookRuntime(
  input: InitializeHookRuntimeInput
): Promise<InitializedHookRuntime | undefined> {
  const config = await loadEnabledReporterConfig(input.configPath);
  if (!config) {
    return undefined;
  }

  const debugLogger: DebugLogger = createDebugLogger(config, input.source, input.worktree);
  debugLogger.log(input.configLoadedStep, {
    enabled: config.enabled,
    endpoint: config.endpoint,
    debug: config.debug,
  });

  return {
    config,
    debugLogger,
  };
}

export async function resolveGitContextOrEmpty(
  worktree: string,
  debugLogger?: DebugLogger,
  fallbackFilePath?: string
): Promise<GitContext> {
  const primary = await resolveGitContext(worktree)
    .then((gitContext) => {
      debugLogger?.log('runtime.git.resolve.success', {
        worktree,
        gitUrl: gitContext.gitUrl,
        branch: gitContext.branch,
        username: gitContext.username,
        commitHash: gitContext.commitHash,
      });
      return gitContext;
    })
    .catch((error) => {
      const message: string = error instanceof Error ? error.message : String(error);
      logError(`获取 Git 上下文失败: ${message}`);
      debugLogger?.log('runtime.git.resolve.error', {
        worktree,
        message,
      });
      return { ...EMPTY_GIT_CONTEXT };
    });

  if ((primary.username && primary.gitUrl) || !fallbackFilePath) {
    return primary;
  }

  const fallbackDir: string = path.dirname(fallbackFilePath);
  const fallback = await resolveGitContext(fallbackDir).catch(() => ({ ...EMPTY_GIT_CONTEXT }));

  debugLogger?.log('runtime.git.resolve.fallback', {
    fallbackDir,
    gitUrl: fallback.gitUrl,
    branch: fallback.branch,
    username: fallback.username,
    commitHash: fallback.commitHash,
  });

  return {
    username: primary.username || fallback.username,
    gitUrl: primary.gitUrl || fallback.gitUrl,
    branch: primary.branch || fallback.branch,
    commitHash: primary.commitHash || fallback.commitHash,
  };
}

export async function reportTelemetryRecords(
  config: ReporterConfig,
  records: TelemetryRecord[],
  debugLogger?: DebugLogger
): Promise<void> {
  if (records.length === 0) {
    debugLogger?.log('runtime.report.skip', { reason: 'empty-records' });
    return;
  }

  debugLogger?.log('runtime.report.start', {
    recordCount: records.length,
  });

  const reporter: TelemetryReporter = new TelemetryReporter(config, undefined, debugLogger);

  try {
    reporter.enqueue(records);
    await reporter.flush();
  } finally {
    await reporter.dispose();
  }
}

export async function finalizeTelemetryHook(
  input: FinalizeTelemetryHookInput
): Promise<TelemetryRecord[]> {
  if (input.changes.length === 0) {
    await input.debugLogger.flush();
    return [];
  }

  const gitContext = await resolveGitContextOrEmpty(
    input.worktree,
    input.debugLogger,
    input.changes[0]?.filePath
  );

  const records: TelemetryRecord[] = input.buildRecords(gitContext);
  input.debugLogger.log(input.recordsStep, {
    ...(input.recordsData ?? {}),
    recordCount: records.length,
  });

  if (records.length === 0) {
    await input.debugLogger.flush();
    return [];
  }

  try {
    await reportTelemetryRecords(input.config, records, input.debugLogger);
  } catch (error) {
    if (input.onReportError) {
      return input.onReportError(error, input.debugLogger);
    }

    throw error;
  }

  return records;
}
