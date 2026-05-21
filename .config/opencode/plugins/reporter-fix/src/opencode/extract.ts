import {
  buildAcceptedChange,
  coalesceAcceptedChanges,
  extractAcceptedLines,
  extractAddedLinesFromUnifiedPatch,
  type AcceptedChange,
} from '../shared/change.ts';
import { resolveWithinWorktree } from '../shared/path.ts';
import { isRecord, readString } from '../shared/value.ts';

export { extractAcceptedLines } from '../shared/change.ts';

export interface PendingWrite {
  filePath: string;
  before: string;
  /**
   * `true` when no `before` snapshot was captured (e.g. tool didn't go
   * through `tool.execute.before`, or the file was unreadable). Distinguishes
   * "new file" from "we don't know what was there", so the fallback path can
   * refuse to fabricate a "whole file is new" diff that would over-report.
   */
  beforeMissing?: boolean;
  ts?: number;
}

export interface ExtractToolChangeInput {
  tool: string;
  args: unknown;
  metadata: unknown;
  directory: string;
  /** Worktree root used for path-containment validation. */
  worktree: string;
  pendingWrite?: PendingWrite;
  /** Set when the `tool.execute.after` hook seeded `pendingWrite` lazily. */
  newFile?: boolean;
  /**
   * Fresh on-disk content read just after the tool finished. Used as a
   * fallback when the SDK metadata schema does not expose the post-image
   * (which is the case for opencode >= 1.15 `edit` / `multiedit`).
   */
  afterContent?: string;
}

interface FileDiffLike {
  file?: unknown;
  before?: unknown;
  after?: unknown;
}

interface ApplyPatchFileLike {
  filePath?: unknown;
  movePath?: unknown;
  patch?: unknown;
  type?: unknown;
}

interface MultiEditResultLike {
  filediff?: FileDiffLike;
}

function safeResolveFilePath(
  input: ExtractToolChangeInput,
  raw: string | undefined
): string | undefined {
  if (!raw) return undefined;
  return resolveWithinWorktree(input.directory, raw, input.worktree);
}

function fromFileDiff(input: ExtractToolChangeInput, fileDiff: FileDiffLike): AcceptedChange[] {
  const filePath: string | undefined = safeResolveFilePath(input, readString(fileDiff.file));
  const before: string | undefined = readString(fileDiff.before);
  const after: string | undefined = readString(fileDiff.after);

  if (!filePath || before === undefined || after === undefined) {
    return [];
  }

  return [
    {
      filePath,
      lines: extractAcceptedLines(before, after),
    },
  ];
}

function readArgsFilePath(input: ExtractToolChangeInput): string | undefined {
  const args: Record<string, unknown> | undefined = isRecord(input.args) ? input.args : undefined;
  return safeResolveFilePath(input, readString(args?.filePath));
}

function readMetadataFilePath(input: ExtractToolChangeInput): string | undefined {
  const metadata: Record<string, unknown> | undefined = isRecord(input.metadata)
    ? input.metadata
    : undefined;
  const raw: string | undefined =
    readString(metadata?.filepath) ?? readString(metadata?.filePath);
  return safeResolveFilePath(input, raw);
}

/**
 * Last-resort fallback: produce an AcceptedChange from `pendingWrite.before`
 * and the freshly read on-disk `afterContent`. Returns [] when:
 *   - we can't resolve a worktree-contained file path
 *   - we have no after-image
 *   - we know we missed the before-snapshot AND the file already existed
 *     (i.e. a pre-existing file had its snapshot lost — fabricating an
 *     "everything is new" diff would massively over-report).
 */
function fallbackFromPendingAndDisk(input: ExtractToolChangeInput): AcceptedChange[] {
  const pending = input.pendingWrite;
  const after = input.afterContent;
  if (after === undefined) return [];

  const filePath: string | undefined =
    pending?.filePath ?? readMetadataFilePath(input) ?? readArgsFilePath(input);
  if (!filePath) return [];

  // Distinguish "new file" (no before snapshot needed) from "we lost the
  // before snapshot for an existing file". Only the former is safe to
  // fallback-report wholesale.
  if (pending?.beforeMissing && !input.newFile) {
    return [];
  }

  const before: string = pending?.before ?? '';
  const lines = extractAcceptedLines(before, after);
  if (lines.length === 0) return [];

  return [{ filePath, lines }];
}

function extractWriteChanges(input: ExtractToolChangeInput): AcceptedChange[] {
  const args: Record<string, unknown> | undefined = isRecord(input.args) ? input.args : undefined;
  // Prefer the freshly read on-disk content over `args.content`: the latter
  // is what the AI *intended* to write, which can diverge from what is
  // actually persisted (e.g. server-side post-write hooks, formatter).
  const after: string | undefined = input.afterContent ?? readString(args?.content);
  const filePath: string | undefined = readMetadataFilePath(input) ?? readArgsFilePath(input);

  if (!filePath || after === undefined) {
    return [];
  }

  return [
    {
      filePath,
      lines: extractAcceptedLines(input.pendingWrite?.before ?? '', after),
    },
  ];
}

function extractEditChanges(input: ExtractToolChangeInput): AcceptedChange[] {
  // Preferred path: metadata.filediff (legacy schema).
  if (isRecord(input.metadata) && isRecord(input.metadata.filediff)) {
    const direct = fromFileDiff(input, input.metadata.filediff);
    if (direct.length > 0) return direct;
  }
  // Fallback path: opencode >= 1.15 no longer exposes filediff in metadata,
  // reconstruct from pendingWrite.before + on-disk after.
  return fallbackFromPendingAndDisk(input);
}

function extractApplyPatchChanges(input: ExtractToolChangeInput): AcceptedChange[] {
  const metadata = input.metadata;
  if (isRecord(metadata) && Array.isArray(metadata.files)) {
    const fromMetadata = coalesceAcceptedChanges(
      metadata.files.flatMap((item: unknown) => {
        if (!isRecord(item)) return [];

        const patchFile: ApplyPatchFileLike = item;
        if (patchFile.type === 'delete') return [];

        const rawPath: string | undefined =
          readString(patchFile.movePath) ?? readString(patchFile.filePath);
        const filePath: string | undefined = safeResolveFilePath(input, rawPath);
        const patch: string | undefined = readString(patchFile.patch);

        if (!filePath || patch === undefined) return [];

        return buildAcceptedChange(filePath, extractAddedLinesFromUnifiedPatch(patch));
      })
    );
    if (fromMetadata.length > 0) return fromMetadata;
  }
  return fallbackFromPendingAndDisk(input);
}

function extractMultiEditChanges(input: ExtractToolChangeInput): AcceptedChange[] {
  const metadata = input.metadata;
  if (isRecord(metadata) && Array.isArray(metadata.results)) {
    const grouped: Map<string, { before: string; after: string }> = new Map();

    for (const item of metadata.results) {
      if (!isRecord(item) || !isRecord(item.filediff)) continue;

      const result: MultiEditResultLike = item;
      const filePath: string | undefined = safeResolveFilePath(
        input,
        readString(result.filediff?.file)
      );
      const before: string | undefined = readString(result.filediff?.before);
      const after: string | undefined = readString(result.filediff?.after);

      if (!filePath || before === undefined || after === undefined) continue;

      const existing = grouped.get(filePath);
      if (!existing) {
        grouped.set(filePath, { before, after });
        continue;
      }

      grouped.set(filePath, { before: existing.before, after });
    }

    if (grouped.size > 0) {
      return Array.from(grouped.entries(), ([filePath, change]) => ({
        filePath,
        lines: extractAcceptedLines(change.before, change.after),
      }));
    }
  }
  return fallbackFromPendingAndDisk(input);
}

export function extractToolChanges(input: ExtractToolChangeInput): AcceptedChange[] {
  switch (input.tool) {
    case 'write':
      return extractWriteChanges(input);
    case 'edit':
      return extractEditChanges(input);
    case 'apply_patch':
      return extractApplyPatchChanges(input);
    case 'multiedit':
      return extractMultiEditChanges(input);
    default:
      return [];
  }
}
