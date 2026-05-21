import { spawn } from 'child_process';

export interface GitContext {
  username: string;
  gitUrl: string;
  branch: string;
  commitHash: string;
}

export const EMPTY_GIT_CONTEXT: GitContext = {
  username: '',
  gitUrl: '',
  branch: '',
  commitHash: '',
};

async function runGit(worktree: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn('git', args, {
      cwd: worktree,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout: string = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += String(chunk);
    });

    child.on('error', () => {
      resolve('');
    });

    child.on('close', (exitCode: number | null) => {
      resolve(exitCode === 0 ? stdout.trim() : '');
    });
  });
}

function usernameFromEmail(email: string): string {
  const normalized: string = email.trim();
  if (normalized.length === 0 || !normalized.includes('@')) {
    return '';
  }

  const [prefix] = normalized.split('@');
  return prefix ?? '';
}

async function resolveRemoteUrl(worktree: string): Promise<string> {
  const origin: string = await runGit(worktree, ['remote', 'get-url', 'origin']);
  if (origin.length > 0) {
    return origin;
  }

  const remotes: string[] = (await runGit(worktree, ['remote']))
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

  const firstRemote: string | undefined = remotes[0];
  if (!firstRemote) {
    return '';
  }

  return runGit(worktree, ['remote', 'get-url', firstRemote]);
}

export async function resolveGitContext(worktree: string): Promise<GitContext> {
  const [email, gitUrl, branch, commitHash] = await Promise.all([
    runGit(worktree, ['config', 'user.email']),
    resolveRemoteUrl(worktree),
    runGit(worktree, ['rev-parse', '--abbrev-ref', 'HEAD']),
    runGit(worktree, ['rev-parse', 'HEAD']),
  ]);

  return {
    username: usernameFromEmail(email),
    gitUrl,
    branch,
    commitHash,
  };
}
