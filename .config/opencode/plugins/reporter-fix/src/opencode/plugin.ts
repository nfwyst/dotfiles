import type { Plugin } from '@opencode-ai/plugin';
import path from 'path';
import { createHash } from 'node:crypto';
import { readOptionalTextFile } from '../shared/file.ts';
import { createDebugLogger, type DebugLogger } from '../shared/debug.ts';
import { type GitContext } from '../shared/git.ts';
import { logError } from '../shared/log.ts';
import { formatQualifiedModel } from '../shared/model.ts';
import { resolveAbsolutePath, resolveWithinWorktree } from '../shared/path.ts';
import { TelemetryReporter, type TelemetryRecord } from '../shared/reporter.ts';
import { loadEnabledReporterConfig, resolveGitContextOrEmpty } from '../shared/runtime.ts';
import { extractToolChanges, extractAcceptedLines, type PendingWrite } from './extract.ts';
import { buildTelemetryRecords, TELEMETRY_SOURCE } from './telemetry.ts';
import { isRecord } from '../shared/value.ts';
import type {
  ChatMessageInput,
  ChatMessageOutput,
  ChatParamsInput,
  ChatParamsOutput,
  PluginEvent,
  PluginEventInput,
  ToolExecuteAfterInput,
  ToolExecuteAfterHookInput,
  ToolExecuteAfterOutput,
  ToolExecuteBeforeInput,
  ToolExecuteBeforeOutput,
} from './types.ts';

const CODE_TOOLS: Set<string> = new Set(['write', 'edit', 'apply_patch', 'multiedit']);
const TOOLS_WITH_BEFORE_SNAPSHOT: Set<string> = new Set(['write', 'edit', 'multiedit']);
const MAX_CACHE_SIZE = 500;
const TEXT_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java',
  '.kt', '.swift', '.vue', '.svelte', '.css', '.scss', '.less', '.html',
  '.json', '.yaml', '.yml', '.toml', '.md', '.sql', '.sh', '.bash', '.zsh',
  '.rb', '.php', '.c', '.cpp', '.cc', '.h', '.hpp', '.cs', '.lua',
]);
/**
 * Time-window for `reportedFiles` dedup. Must be at least as long as the
 * configured `flushIntervalMs` plus a small safety margin so the
 * `file.edited` event that fires *after* the tool hook has already flushed
 * is suppressed reliably. We keep this conservative at 30 s.
 */
const REPORTED_FILE_TTL_MS = 30000;
/**
 * Inactivity TTL for `pendingWrites` cleanup; previously 30 s but we now
 * scrub on every after-hook anyway, so a longer TTL costs nothing and keeps
 * long-running write tools (e.g. apply_patch on a giant codegen) safe.
 */
const PENDING_WRITE_TTL_MS = 120000;

const NUL_BYTE_BINARY_PROBE_BYTES = 8000;

type RuntimePluginEvent =
  | PluginEvent
  | { type: 'vcs.branch.updated'; properties: { branch?: string } }
  | { type: 'file.edited'; properties: { file: string } }
  | { type: 'file.watcher.updated'; properties: { file: string; event: string } };

function pendingWriteKey(sessionId: string, callId: string): string {
  return `${sessionId}:${callId}`;
}

function resolveFilePath(directory: string, filePath: string): string {
  return resolveAbsolutePath(directory, filePath);
}

async function readExistingFile(filePath: string): Promise<string> {
  return (await readOptionalTextFile(filePath)) ?? '';
}

function hasTextExtension(filePath: string): boolean {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot < 0) return false;
  return TEXT_EXTS.has(filePath.slice(lastDot).toLowerCase());
}

/**
 * Cheap binary check: scan the first ~8 KB for NUL. Most binary formats
 * (PNG, ELF, .so, .class, .pyc, archives) hit this immediately. Used in
 * addition to the extension allow-list as a defence in depth.
 */
function looksLikeBinary(content: string): boolean {
  const probeLength = Math.min(content.length, NUL_BYTE_BINARY_PROBE_BYTES);
  for (let i = 0; i < probeLength; i++) {
    if (content.charCodeAt(i) === 0) return true;
  }
  return false;
}

function hashContent(content: string): string {
  return createHash('sha1').update(content).digest('hex');
}

function setLruCache(map: Map<string, string>, key: string, value: string, max: number): void {
  // Refresh LRU order: delete-then-set moves the key to the back of the
  // insertion order. Then evict from the front while we are over budget.
  if (map.has(key)) map.delete(key);
  map.set(key, value);
  while (map.size > max) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

interface ReportedFileEntry {
  expiresAt: number;
  contentHash: string;
}

export const ReporterPlugin: Plugin = async ({ directory, worktree }) => {
  const config = await loadEnabledReporterConfig();
  if (!config) {
    return {};
  }

  const debugLogger: DebugLogger = createDebugLogger(config, TELEMETRY_SOURCE, worktree);
  debugLogger.log('opencode.plugin.config.loaded', {
    enabled: config.enabled,
    endpoint: config.endpoint,
    debug: config.debug,
  });
  debugLogger.log('opencode.plugin.init', { directory, worktree });

  const reporter: TelemetryReporter = new TelemetryReporter(config, undefined, debugLogger);
  const pendingWrites: Map<string, PendingWrite> = new Map();
  const sessionModels: Map<string, string> = new Map();
  const sessionBaseUrls: Map<string, string> = new Map();
  // Per-session model/base-url state. The legacy `lastModel` / `lastBaseUrl`
  // globals would bleed values across concurrent sessions; we keep one entry
  // for the most recent session as a *fallback only*, never the source of
  // truth when a session-scoped value is available.
  let mostRecentSessionId: string | undefined;
  const fileCache: Map<string, string> = new Map();
  const cacheLock: Map<string, Promise<void>> = new Map();
  const reportedFiles: Map<string, ReportedFileEntry> = new Map();
  const newFiles: Set<string> = new Set();
  const gitContext: GitContext = await resolveGitContextOrEmpty(worktree, debugLogger);

  function getSessionModel(sessionID: string | undefined): string | undefined {
    if (sessionID && sessionModels.has(sessionID)) return sessionModels.get(sessionID);
    return mostRecentSessionId ? sessionModels.get(mostRecentSessionId) : undefined;
  }

  function getSessionBaseUrl(sessionID: string | undefined): string | undefined {
    if (sessionID && sessionBaseUrls.has(sessionID)) return sessionBaseUrls.get(sessionID);
    return mostRecentSessionId ? sessionBaseUrls.get(mostRecentSessionId) : undefined;
  }

  function rememberReported(filePath: string, contentHash: string): void {
    reportedFiles.set(filePath, {
      expiresAt: Date.now() + REPORTED_FILE_TTL_MS,
      contentHash,
    });
  }

  function isAlreadyReported(filePath: string, contentHash: string): boolean {
    const entry = reportedFiles.get(filePath);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      reportedFiles.delete(filePath);
      return false;
    }
    return entry.contentHash === contentHash;
  }

  function scrubExpired(): void {
    const now = Date.now();
    for (const [key, entry] of reportedFiles) {
      if (entry.expiresAt < now) reportedFiles.delete(key);
    }
    for (const [key, pw] of pendingWrites) {
      if (pw.ts && now - pw.ts > PENDING_WRITE_TTL_MS) pendingWrites.delete(key);
    }
  }

  function safeResolve(filePathArg: string): string | undefined {
    return resolveWithinWorktree(directory, filePathArg, worktree);
  }

  // Best-effort dispose hook: opencode does not expose a dedicated lifecycle
  // method for plugins, so we attach to `beforeExit` to flush whatever is
  // still in the queue. `unref` is implicit on process events.
  const onBeforeExit = (): void => {
    void reporter.dispose().catch(() => undefined);
  };
  process.once('beforeExit', onBeforeExit);

  return {
    async event(input: PluginEventInput) {
      try {
        const evt = input.event as RuntimePluginEvent;

        if (evt.type === 'vcs.branch.updated') {
          if (typeof evt.properties.branch === 'string') {
            gitContext.branch = evt.properties.branch;
            debugLogger.log('opencode.branch.updated', { branch: gitContext.branch });
          }
          return;
        }

        if (evt.type === 'file.watcher.updated') {
          const fp = evt.properties.file;
          if (evt.properties.event === 'add') {
            newFiles.add(fp);
          } else if (evt.properties.event === 'unlink') {
            newFiles.delete(fp);
            fileCache.delete(fp);
          }
          return;
        }

        if (evt.type === 'file.edited') {
          const filePath = evt.properties.file;
          const ext = filePath ? filePath.slice(filePath.lastIndexOf('.')).toLowerCase() : '';
          const ignored = filePath && config.ignorePath.some((f) => filePath.includes(f));
          debugLogger.log('opencode.event.file.edited.enter', {
            filePath,
            ext,
            ignored,
          });
          if (!filePath || ignored) return;
          if (!hasTextExtension(filePath)) {
            debugLogger.log('opencode.event.file.edited.skip', {
              filePath,
              reason: 'non-text-ext',
            });
            return;
          }

          const sessionID: string | undefined = mostRecentSessionId;
          const model = getSessionModel(sessionID);
          const baseUrl = getSessionBaseUrl(sessionID);

          const prev = cacheLock.get(filePath) ?? Promise.resolve();
          const done = prev
            .then(async () => {
              const after = await readExistingFile(filePath).catch((err) => {
                debugLogger.log('opencode.event.file.edited.read.error', {
                  filePath,
                  error: String(err),
                });
                return '';
              });
              if (after.length === 0) return;
              if (looksLikeBinary(after)) {
                debugLogger.log('opencode.event.file.edited.skip', {
                  filePath,
                  reason: 'binary',
                });
                return;
              }

              const afterHash = hashContent(after);
              if (isAlreadyReported(filePath, afterHash)) {
                debugLogger.log('opencode.event.file.edited.dedup', { filePath });
                return;
              }

              const before = fileCache.get(filePath) ?? '';
              const cacheHit = before !== '';
              setLruCache(fileCache, filePath, after, MAX_CACHE_SIZE);
              newFiles.delete(filePath);

              const lines = extractAcceptedLines(before, after);
              debugLogger.log('opencode.event.file.edited.diff', {
                filePath,
                cacheHit,
                beforeLen: before.length,
                afterLen: after.length,
                lineCount: lines.length,
                cacheSize: fileCache.size,
              });
              if (lines.length === 0) return;

              const records = buildTelemetryRecords({
                changes: [{ filePath, lines }],
                gitContext,
                sessionId: sessionID ?? '__file__',
                toolName: 'file.edited',
                callId: `file:${filePath}`,
                maxContentLength: config.maxContentLength,
                ignorePath: [],
                model,
                baseUrl,
                commitHash: gitContext.commitHash || undefined,
              });

              debugLogger.log('opencode.event.file.edited.records', {
                filePath,
                recordCount: records.length,
              });
              if (records.length > 0) {
                rememberReported(filePath, afterHash);
                reporter.enqueue(records);
              }
            })
            .finally(() => {
              // Only release the lock if the latest entry is still ours.
              if (cacheLock.get(filePath) === done) cacheLock.delete(filePath);
            });

          cacheLock.set(filePath, done);
          await done;
          return;
        }
      } catch (error) {
        const message: string = error instanceof Error ? error.message : String(error);
        logError(`event 处理失败: ${message}`);
        debugLogger.log('opencode.event.error', { message });
      }
    },
    async 'chat.message'(input: ChatMessageInput, _output: ChatMessageOutput) {
      try {
        const model: string | undefined = input.model
          ? formatQualifiedModel(input.model.providerID, input.model.modelID)
          : undefined;

        if (model) {
          sessionModels.set(input.sessionID, model);
          mostRecentSessionId = input.sessionID;
          debugLogger.log('opencode.chat.message.model', {
            sessionId: input.sessionID,
            model,
          });
        }
      } catch (error) {
        const message: string = error instanceof Error ? error.message : String(error);
        debugLogger.log('opencode.chat.message.error', { message });
      }
    },
    async 'chat.params'(rawInput: unknown, _output: unknown) {
      try {
        const input = rawInput as ChatParamsInput & { provider?: unknown };
        const providerCandidate: unknown = (input.model as unknown as Record<string, unknown>)
          ?.provider;
        const providerIdFromModel: string | undefined =
          isRecord(providerCandidate) && typeof providerCandidate.id === 'string'
            ? providerCandidate.id
            : undefined;
        const providerIdFromTop: string | undefined =
          isRecord(input.provider) && typeof (input.provider as Record<string, unknown>).id === 'string'
            ? ((input.provider as Record<string, unknown>).id as string)
            : undefined;
        const providerId: string | undefined = providerIdFromTop ?? providerIdFromModel;
        const modelId: string | undefined =
          typeof (input.model as { id?: unknown })?.id === 'string'
            ? ((input.model as { id?: unknown }).id as string)
            : undefined;

        const model: string | undefined = formatQualifiedModel(providerId, modelId);

        if (model) {
          sessionModels.set(input.sessionID, model);
          mostRecentSessionId = input.sessionID;
          debugLogger.log('opencode.chat.params.model', {
            sessionId: input.sessionID,
            model,
          });
        }

        const provider: unknown = input.provider;
        const api =
          isRecord(provider) && typeof (provider as Record<string, unknown>).api === 'string'
            ? ((provider as Record<string, unknown>).api as string)
            : '';
        if (api.length > 0) {
          sessionBaseUrls.set(input.sessionID, api);
          mostRecentSessionId = input.sessionID;
          debugLogger.log('opencode.chat.params.base-url', {
            sessionId: input.sessionID,
            baseUrl: api,
          });
        }
      } catch (error) {
        const message: string = error instanceof Error ? error.message : String(error);
        debugLogger.log('opencode.chat.params.error', { message });
      }
    },
    async 'tool.execute.before'(input: ToolExecuteBeforeInput, output: ToolExecuteBeforeOutput) {
      try {
        if (!config.enabled || !TOOLS_WITH_BEFORE_SNAPSHOT.has(input.tool)) {
          return;
        }

        const args: Record<string, unknown> | undefined =
          typeof output.args === 'object' && output.args !== null && !Array.isArray(output.args)
            ? (output.args as Record<string, unknown>)
            : undefined;

        const filePathArg: unknown = args?.filePath;
        if (typeof filePathArg !== 'string' || filePathArg.length === 0) {
          return;
        }

        const filePath: string | undefined = safeResolve(filePathArg);
        if (!filePath) {
          debugLogger.log('opencode.tool.before.snapshot.skip', {
            sessionId: input.sessionID,
            callId: input.callID,
            toolName: input.tool,
            filePathArg,
            reason: 'outside-worktree',
          });
          return;
        }

        debugLogger.log('opencode.tool.before.snapshot', {
          sessionId: input.sessionID,
          callId: input.callID,
          toolName: input.tool,
          filePath,
        });

        let beforeMissing = false;
        const before: string = await readExistingFile(filePath).catch((error) => {
          const message: string = error instanceof Error ? error.message : String(error);
          logError(`写入前读取文件失败: ${message}`);
          debugLogger.log('opencode.tool.before.snapshot.error', {
            toolName: input.tool,
            filePath,
            message,
          });
          beforeMissing = true;
          return '';
        });

        pendingWrites.set(pendingWriteKey(input.sessionID, input.callID), {
          filePath,
          before,
          beforeMissing,
          ts: Date.now(),
        });
        debugLogger.log('opencode.tool.before.snapshot.cached', {
          sessionId: input.sessionID,
          callId: input.callID,
          toolName: input.tool,
          filePath,
          beforeLength: before.length,
          beforeMissing,
        });
      } catch (error) {
        const message: string = error instanceof Error ? error.message : String(error);
        logError(`tool.execute.before 处理失败: ${message}`);
        debugLogger.log('opencode.tool.before.error', { message });
      }
    },
    async 'tool.execute.after'(input: ToolExecuteAfterHookInput, output: ToolExecuteAfterOutput) {
      try {
        if (!config.enabled || !CODE_TOOLS.has(input.tool)) {
          return;
        }

        debugLogger.log('opencode.tool.after.start', {
          sessionId: input.sessionID,
          callId: input.callID,
          toolName: input.tool,
        });

        const runtimeInput: ToolExecuteAfterInput = input as ToolExecuteAfterInput;
        const cacheKey: string = pendingWriteKey(input.sessionID, input.callID);
        let pendingWrite: PendingWrite | undefined = pendingWrites.get(cacheKey);

        // For apply_patch we skip the before-hook (multiple files in patch
        // body), so manufacture pendingWrite entries lazily here from
        // metadata so the per-file fallback path still has a before image.
        // For all other tools, if pendingWrite is missing entirely it means
        // either we missed the before-hook or the snapshot failed; the
        // fallback path will refuse to fabricate diffs in that case.
        let afterContent: string | undefined;
        if (pendingWrite?.filePath) {
          const filePath = pendingWrite.filePath;
          afterContent = await readExistingFile(filePath).catch((error) => {
            const message: string = error instanceof Error ? error.message : String(error);
            debugLogger.log('opencode.tool.after.read.error', {
              toolName: input.tool,
              filePath,
              message,
            });
            return undefined;
          });
          debugLogger.log('opencode.tool.after.read', {
            toolName: input.tool,
            filePath,
            beforeLength: pendingWrite.before.length,
            afterLength: afterContent?.length ?? -1,
            beforeMissing: pendingWrite.beforeMissing ?? false,
          });
        }

        const changes = extractToolChanges({
          tool: input.tool,
          args: runtimeInput.args,
          metadata: output.metadata,
          directory,
          worktree,
          pendingWrite,
          afterContent,
          newFile: pendingWrite ? pendingWrite.before.length === 0 : false,
        });

        // Filter out non-text/binary files we should never report.
        const filteredChanges = changes.filter((change) => {
          if (!hasTextExtension(change.filePath)) {
            debugLogger.log('opencode.tool.after.skip', {
              filePath: change.filePath,
              reason: 'non-text-ext',
            });
            return false;
          }
          return true;
        });

        debugLogger.log('opencode.tool.after.changes', {
          toolName: input.tool,
          changeCount: filteredChanges.length,
          dropped: changes.length - filteredChanges.length,
          usedFallback: filteredChanges.length > 0 && afterContent !== undefined,
        });

        pendingWrites.delete(cacheKey);

        for (const change of filteredChanges) {
          // Seed the file.edited cache so the watcher event that fires after
          // this hook does not double-report. We re-read disk for files we
          // didn't have an `afterContent` for (apply_patch's per-file path).
          let cacheValue: string | undefined = afterContent;
          if (cacheValue === undefined || (pendingWrite && change.filePath !== pendingWrite.filePath)) {
            cacheValue = await readExistingFile(change.filePath).catch(() => undefined);
          }
          if (cacheValue !== undefined) {
            setLruCache(fileCache, change.filePath, cacheValue, MAX_CACHE_SIZE);
            rememberReported(change.filePath, hashContent(cacheValue));
          } else {
            // Even without disk content we still want to suppress the very
            // next file.edited within the TTL using a placeholder hash.
            rememberReported(change.filePath, '__no_disk__');
          }
        }

        scrubExpired();

        const model: string | undefined = getSessionModel(input.sessionID);
        const baseUrl: string | undefined = getSessionBaseUrl(input.sessionID);

        const records: TelemetryRecord[] = buildTelemetryRecords({
          changes: filteredChanges,
          gitContext,
          sessionId: input.sessionID,
          toolName: input.tool,
          callId: input.callID,
          maxContentLength: config.maxContentLength,
          ignorePath: config.ignorePath,
          model,
          baseUrl,
          commitHash: gitContext.commitHash || undefined,
        });

        debugLogger.log('opencode.tool.after.records', {
          toolName: input.tool,
          recordCount: records.length,
        });

        reporter.enqueue(records);
      } catch (error) {
        const message: string = error instanceof Error ? error.message : String(error);
        logError(`tool.execute.after 处理失败: ${message}`);
        debugLogger.log('opencode.tool.after.error', { message });
      }
    },
  };
};

export default ReporterPlugin;

// `path` import is referenced above only via `resolveAbsolutePath`; we keep
// the explicit import to satisfy bundlers that don't tree-shake re-exports.
void path;
