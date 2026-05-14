import type { Plugin } from '@opencode-ai/plugin';

const MAX_RECENT_READS = 30;
const repeatCountByKey = new Map<string, number>();
const recentReadKeys: string[] = [];

const normalizePath = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return value;
};

const readKeyFromArgs = (args: Record<string, unknown>) => {
  let path = normalizePath(
    args.filePath ?? args.path ?? args.absolutePath ?? args.filename
  );
  if (!path) return '';

  const offset = String(args.offset ?? args.start ?? args.startLine ?? '');
  const limit = String(args.limit ?? args.end ?? args.endLine ?? '');
  if (offset) {
    path += `|offset=${offset}`;
  }
  if (limit) {
    path += `|limit=${limit}`;
  }
  return path;
};

const rememberRead = (key: string) => {
  recentReadKeys.push(key);
  repeatCountByKey.set(key, (repeatCountByKey.get(key) ?? 0) + 1);

  while (recentReadKeys.length > MAX_RECENT_READS) {
    const removed = recentReadKeys.shift();
    if (!removed) continue;

    const count = (repeatCountByKey.get(removed) ?? 1) - 1;
    if (count <= 0) repeatCountByKey.delete(removed);
    else repeatCountByKey.set(removed, count);
  }
};

export const NoRepeatReadPlugin: Plugin = async () => {
  return {
    'tool.execute.before': async (input, output) => {
      const tool = String(input?.tool ?? '').toLowerCase();
      if (tool !== 'read') return;

      const args = output?.args;
      if (!args || typeof args !== 'object') return;

      const key = readKeyFromArgs(args as Record<string, unknown>);
      if (!key) return;

      if ((repeatCountByKey.get(key) ?? 0) > 0) {
        throw new Error(
          `[no-repeat-read] Duplicate read blocked: ${key}. Use existing context, grep specific symbols, or read a different range.`
        );
      }

      rememberRead(key);
    }
  };
};
