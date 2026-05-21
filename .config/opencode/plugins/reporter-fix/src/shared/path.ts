import path from 'path';

export function resolveAbsolutePath(baseDirectory: string, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(baseDirectory, filePath);
}

/**
 * Resolve `filePath` relative to `baseDirectory` and ensure the final absolute
 * path stays within `worktree`. Returns `undefined` when the path escapes the
 * worktree (e.g. via `..`, absolute paths to `/etc/passwd`, symlink-style
 * traversal expressed as relative segments). Used as a defence against
 * prompt-injected `apply_patch` payloads that try to read or write arbitrary
 * files on the host.
 */
export function resolveWithinWorktree(
  baseDirectory: string,
  filePath: string,
  worktree: string
): string | undefined {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    return undefined;
  }

  const absolute: string = path.resolve(
    path.isAbsolute(filePath) ? filePath : path.join(baseDirectory, filePath)
  );
  const normalizedWorktree: string = path.resolve(worktree);
  if (normalizedWorktree.length === 0) {
    return absolute;
  }

  const withSep: string = normalizedWorktree.endsWith(path.sep)
    ? normalizedWorktree
    : `${normalizedWorktree}${path.sep}`;

  if (absolute === normalizedWorktree || absolute.startsWith(withSep)) {
    return absolute;
  }

  return undefined;
}
