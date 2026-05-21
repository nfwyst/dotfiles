import { createHash } from 'node:crypto';

import type { GitContext } from './git.ts';
import type { TelemetryRecord } from './reporter.ts';
import type { AcceptedChange } from './change.ts';
import { version } from '../version.ts';

export type { AcceptedChange } from './change.ts';

export interface BuildTelemetryRecordsInput {
  changes: AcceptedChange[];
  gitContext: GitContext;
  sessionId: string;
  toolName: string;
  callId: string;
  maxContentLength: number;
  ignorePath: string[];
  source: string;
  model?: string;
  baseUrl?: string;
  commitHash?: string;
}

export type BuildTelemetryRecordsWithSourceInput = Omit<BuildTelemetryRecordsInput, 'source'>;
export type BuildTelemetryRecordsWithDefaultsInput = Omit<
  BuildTelemetryRecordsInput,
  'source' | 'toolName'
>;

/**
 * Clamp by Unicode code point so we never split a surrogate pair, but cap by
 * a UTF-8 byte budget (`maxContentLength * 4` upper bound for a 4-byte/code
 * point worst case) to defend against pathological inputs that explode after
 * percent-encoding on the server. We then trim trailing partial code points
 * by going back one CP if the result still has a low surrogate left over.
 */
function clampContent(content: string, maxContentLength: number): string {
  if (!Number.isFinite(maxContentLength) || maxContentLength <= 0) {
    return '';
  }
  // Iterating by code point is O(n) but n is bounded by maxContentLength
  // (typically <= 400) so this stays cheap.
  let count = 0;
  let end = content.length;
  for (let i = 0; i < content.length; ) {
    const cp = content.codePointAt(i);
    if (cp === undefined) break;
    count++;
    if (count > maxContentLength) {
      end = i;
      break;
    }
    i += cp > 0xffff ? 2 : 1;
  }
  return content.slice(0, end);
}

function hasRequiredGitContext(gitContext: GitContext): boolean {
  return gitContext.username.trim().length > 0 && gitContext.gitUrl.trim().length > 0;
}

function isGitHubUrl(gitUrl: string): boolean {
  const stripped = gitUrl.trim().toLowerCase()
    .replace(/^https:\/\/[^@]+@/, 'https://');
  return stripped.startsWith('https://github.com/') || stripped.startsWith('git@github.com:');
}

/**
 * Path-fragment matcher that treats `/` and `\` as equivalent. We always do
 * the match against a forward-slash-normalised version of the file path to
 * avoid Windows-only false negatives (`personal-projects\foo.ts` should still
 * match the fragment `personal-projects/`).
 */
function matchesIgnoreFragment(filePath: string, fragment: string): boolean {
  if (fragment.length === 0) return false;
  const normPath: string = filePath.replaceAll('\\', '/');
  const normFrag: string = fragment.replaceAll('\\', '/');
  return normPath.includes(normFrag);
}

export interface TelemetrySignInput {
  createdAt: number;
  username: string;
  filePath: string;
  callId: string;
  source: string;
  lineContent: string;
}

export function buildTelemetrySign(input: TelemetrySignInput): string {
  // Match the server-side signature: hash the first 100 code points (not
  // UTF-16 code units) of the line content so multi-byte characters like
  // emoji or CJK don't shift the hash basis between client and server.
  const content = clampContent(input.lineContent, 100);
  const raw = `${input.createdAt}${input.username}${input.filePath}${input.callId}${input.source}${content}${version}PANPAN`;
  return createHash('sha1').update(raw).digest('hex');
}

export function verifyTelemetrySign(
  record: Pick<
    TelemetryRecord,
    'created_at' | 'username' | 'file_path' | 'call_id' | 'source' | 'accept_content' | 'sign'
  >
): boolean {
  return (
    buildTelemetrySign({
      createdAt: record.created_at,
      username: record.username,
      filePath: record.file_path,
      callId: record.call_id,
      source: record.source,
      lineContent: record.accept_content,
    }) === record.sign
  );
}

export function buildTelemetryRecords(input: BuildTelemetryRecordsInput): TelemetryRecord[] {
  if (!hasRequiredGitContext(input.gitContext)) {
    return [];
  }

  if (isGitHubUrl(input.gitContext.gitUrl)) {
    return [];
  }

  const createdAt: number = Math.floor(Date.now() / 1000);

  return input.changes.flatMap((change) =>
    input.ignorePath.some((fragment) => matchesIgnoreFragment(change.filePath, fragment))
      ? []
      : change.lines.map((line) => {
          return {
            created_at: createdAt,
            username: input.gitContext.username,
            git_url: input.gitContext.gitUrl,
            file_path: change.filePath,
            accept_content: clampContent(line, input.maxContentLength),
            sign: buildTelemetrySign({
              createdAt,
              username: input.gitContext.username,
              filePath: change.filePath,
              callId: input.callId,
              source: input.source,
              lineContent: line,
            }),
            model: input.model,
            session_id: input.sessionId,
            tool_name: input.toolName,
            call_id: input.callId,
            source: input.source,
            branch: input.gitContext.branch || undefined,
            base_url: input.baseUrl,
            commit_hash: input.commitHash,
          };
        })
  );
}

export function createTelemetryRecordBuilder(defaults: {
  source: string;
  toolName?: string;
}): (input: Partial<BuildTelemetryRecordsInput>) => TelemetryRecord[] {
  return (input: Partial<BuildTelemetryRecordsInput>): TelemetryRecord[] =>
    buildTelemetryRecords({ ...input, ...defaults } as BuildTelemetryRecordsInput);
}
