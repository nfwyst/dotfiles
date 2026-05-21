import { diffLines } from 'diff/lib/diff/line.js';
import {
  ensureTrailingNewline,
  normalizeNewlines,
  splitNormalizedLines,
  trimTrailingLineBreaks,
} from './text.ts';

export interface AcceptedChange {
  filePath: string;
  lines: string[];
}

export interface ExtractAcceptedLinesOptions {
  keepTrailingNewline?: boolean;
}

/**
 * Drop trailing CR (defence-in-depth, normalizeNewlines should already remove
 * them) and discard fully empty lines. We deliberately keep whitespace-only
 * lines that the AI typed — they are still meaningful for things like
 * indentation-sensitive code or YAML.
 */
export function sanitizeAcceptedLines(lines: string[]): string[] {
  return lines
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.length > 0);
}

export function buildAcceptedChange(
  filePath: string | undefined,
  lines: string[]
): AcceptedChange[] {
  if (!filePath) {
    return [];
  }

  const sanitizedLines: string[] = sanitizeAcceptedLines(lines);
  if (sanitizedLines.length === 0) {
    return [];
  }

  return [{ filePath, lines: sanitizedLines }];
}

export function coalesceAcceptedChanges(changes: AcceptedChange[]): AcceptedChange[] {
  const grouped: Map<string, string[]> = new Map();

  for (const change of changes) {
    if (!grouped.has(change.filePath)) {
      grouped.set(change.filePath, []);
    }

    grouped.get(change.filePath)?.push(...change.lines);
  }

  return Array.from(grouped.entries(), ([filePath, lines]) => ({
    filePath,
    lines: sanitizeAcceptedLines(lines),
  })).filter((change) => change.lines.length > 0);
}

function normalizeAcceptedContent(
  content: string,
  options: ExtractAcceptedLinesOptions | undefined
): string {
  if (options?.keepTrailingNewline) {
    const normalizedContent: string = normalizeNewlines(content);
    return normalizedContent.length === 0 ? '' : ensureTrailingNewline(normalizedContent);
  }

  return trimTrailingLineBreaks(content);
}

/**
 * Filter the diff result so that lines which already existed in `before`
 * (and were merely reordered or duplicated) are not counted as "new". This
 * removes a common false-positive class for refactor-style edits.
 */
function filterReorderFalsePositives(beforeLines: string[], addedLines: string[]): string[] {
  if (addedLines.length === 0) return addedLines;
  const beforeSet: Set<string> = new Set(beforeLines);
  const result: string[] = [];
  for (const line of addedLines) {
    if (line.length === 0) continue;
    if (beforeSet.has(line)) continue;
    result.push(line);
  }
  return result;
}

export function extractAcceptedLines(
  before: string,
  after: string,
  options?: ExtractAcceptedLinesOptions
): string[] {
  const normalizedBefore: string = normalizeAcceptedContent(before, options);
  const normalizedAfter: string = normalizeAcceptedContent(after, options);

  if (normalizedBefore === normalizedAfter) {
    return [];
  }

  if (normalizedBefore.length === 0) {
    return sanitizeAcceptedLines(splitNormalizedLines(normalizedAfter));
  }

  const beforeLines: string[] = splitNormalizedLines(normalizedBefore);
  const addedLines: string[] = diffLines(normalizedBefore, normalizedAfter)
    .filter((change) => change.added)
    .flatMap((change) => splitNormalizedLines(change.value));

  return sanitizeAcceptedLines(filterReorderFalsePositives(beforeLines, addedLines));
}

export function extractAddedLinesFromUnifiedPatchLines(lines: string[]): string[] {
  const added: string[] = [];

  for (const line of lines) {
    if (line.startsWith('+++ ')) {
      continue;
    }

    if (line.startsWith('+')) {
      added.push(line.slice(1));
    }
  }

  return sanitizeAcceptedLines(added);
}

export function extractAddedLinesFromUnifiedPatch(patch: string): string[] {
  const lines: string[] = splitNormalizedLines(patch);
  const added: string[] = [];
  let inHunk: boolean = false;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      inHunk = true;
      continue;
    }

    if (!inHunk || line.startsWith('--- ') || line.startsWith('+++ ')) {
      continue;
    }

    if (line.startsWith('+')) {
      added.push(line.slice(1));
    }
  }

  return sanitizeAcceptedLines(added);
}
