import os from 'os';
import path from 'path';
import { readOptionalTextFile, writeTextFile as writeSharedTextFile } from './file.ts';
import { logError } from './log.ts';
import { isRecord, readString as readOptionalString } from './value.ts';

function getDefaultConfigPaths(homeDirectory: string = os.homedir()): [string, string] {
  return [
    path.join(homeDirectory, '.config', 'byted-reporter-plugin.json'),
    path.join(homeDirectory, '.config', 'opencode', 'byted-reporter-plugin.json'),
  ];
}

export const DEFAULT_CONFIG_PATH: string = getDefaultConfigPaths()[0];

export type ReporterMode = 'line';

/**
 * Default ignore fragments. Anything whose path *contains* one of these
 * substrings will be skipped. We keep this list opinionated and
 * security-conscious: never report credentials, package manager artefacts or
 * untracked build output, even when the user forgets to override the config.
 */
const DEFAULT_IGNORE_PATH: string[] = [
  '/.claude/plans/',
  'personal-projects/',
  // secrets / credentials
  '/.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
  '/.npmrc',
  '/.netrc',
  '/.pypirc',
  'id_rsa',
  'id_ecdsa',
  'id_ed25519',
  '.pem',
  '.key',
  '.p12',
  '.pfx',
  'service-account',
  'credentials.json',
  // VCS / build / cache directories
  '/.git/',
  '/node_modules/',
  '/dist/',
  '/build/',
  '/.next/',
  '/.turbo/',
  '/.cache/',
  '/coverage/',
  '/.venv/',
  '/__pycache__/',
  '/target/',
  '/out/',
  // lockfiles & noise
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'poetry.lock',
  'Cargo.lock',
  '.DS_Store',
  '.log',
];

/**
 * Allowed endpoint host suffixes. Telemetry is internal data; even if the
 * config file is tampered with we never want to ship it to a third-party
 * host. The check is suffix-based against the URL hostname (case-insensitive)
 * with leading-dot semantics so e.g. `pallas.fn.bytedance.net` matches
 * `.bytedance.net`.
 */
const ALLOWED_ENDPOINT_HOST_SUFFIXES: string[] = [
  '.bytedance.net',
  '.byted.org',
  '.bytedance.com',
];

const DEFAULT_ENDPOINT: string = 'https://pallas.fn.bytedance.net/api/telemetry/ai-code';

export const DEFAULT_X_TEAM: string = 'ecom-fe';

const DEFAULT_HEADERS: Record<string, string> = {
  'x-team': DEFAULT_X_TEAM,
};

interface InitReporterConfigOptions {
  xTeam?: string;
}

export interface ReporterConfig {
  enabled: boolean;
  debug: boolean;
  endpoint: string;
  token?: string;
  headers: Record<string, string>;
  ignorePath: string[];
  timeoutMs: number;
  flushIntervalMs: number;
  maxBatchSize: number;
  maxContentLength: number;
  reportMode: ReporterMode;
}

const DEFAULT_CONFIG: ReporterConfig = {
  enabled: false,
  debug: false,
  endpoint: DEFAULT_ENDPOINT,
  headers: DEFAULT_HEADERS,
  ignorePath: DEFAULT_IGNORE_PATH,
  timeoutMs: 3000,
  flushIntervalMs: 10000,
  maxBatchSize: 200,
  maxContentLength: 400,
  reportMode: 'line',
};

const DEFAULT_CONFIG_FILE: Record<string, unknown> = {
  enabled: true,
  debug: false,
  endpoint: DEFAULT_ENDPOINT,
  headers: DEFAULT_HEADERS,
  ignore_path: DEFAULT_IGNORE_PATH,
  timeout_ms: DEFAULT_CONFIG.timeoutMs,
  flush_interval_ms: DEFAULT_CONFIG.flushIntervalMs,
  max_batch_size: DEFAULT_CONFIG.maxBatchSize,
  max_content_length: DEFAULT_CONFIG.maxContentLength,
};

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readString(value: unknown, fallback = ''): string {
  return readOptionalString(value) ?? fallback;
}

function readPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  const normalized: number = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
}

function readHeaders(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return { ...DEFAULT_HEADERS };
  }

  const headers: Record<string, string> = {};
  for (const [key, headerValue] of Object.entries(value)) {
    if (typeof headerValue === 'string' && headerValue.length > 0) {
      headers[key] = headerValue;
    }
  }

  return {
    ...DEFAULT_HEADERS,
    ...headers,
  };
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function isAllowedEndpointHost(hostname: string): boolean {
  const lower: string = hostname.toLowerCase();
  return ALLOWED_ENDPOINT_HOST_SUFFIXES.some(
    (suffix) => lower === suffix.replace(/^\./, '') || lower.endsWith(suffix)
  );
}

function normalizeEndpoint(value: string): string {
  const trimmed: string = value.trim();
  if (trimmed.length === 0) {
    return '';
  }

  let parsed: URL;
  try {
    parsed = new globalThis.URL(trimmed);
  } catch {
    logError(`上报配置 endpoint 不是合法的 URL，已禁用上报: ${trimmed}`);
    return '';
  }

  if (parsed.protocol !== 'https:') {
    logError(`上报配置 endpoint 必须使用 https，已禁用上报: ${trimmed}`);
    return '';
  }

  if (!isAllowedEndpointHost(parsed.hostname)) {
    logError(
      `上报配置 endpoint 主机不在白名单（${ALLOWED_ENDPOINT_HOST_SUFFIXES.join(', ')}），已禁用上报: ${parsed.hostname}`
    );
    return '';
  }

  return parsed.toString();
}

export function parseReporterConfig(raw: unknown): ReporterConfig {
  if (!isRecord(raw)) {
    throw new Error('上报配置必须是 JSON 对象。');
  }

  const endpoint: string = normalizeEndpoint(readString(raw.endpoint));
  const token: string = readString(raw.token).trim();

  return {
    enabled: readBoolean(raw.enabled, true) && endpoint.length > 0,
    debug: readBoolean(raw.debug, DEFAULT_CONFIG.debug),
    endpoint,
    token: token.length > 0 ? token : undefined,
    headers: readHeaders(raw.headers),
    ignorePath:
      raw.ignore_path === undefined ? DEFAULT_IGNORE_PATH : readStringArray(raw.ignore_path),
    timeoutMs: readPositiveInteger(raw.timeout_ms, DEFAULT_CONFIG.timeoutMs),
    flushIntervalMs: readPositiveInteger(raw.flush_interval_ms, DEFAULT_CONFIG.flushIntervalMs),
    maxBatchSize: readPositiveInteger(raw.max_batch_size, DEFAULT_CONFIG.maxBatchSize),
    maxContentLength: readPositiveInteger(raw.max_content_length, DEFAULT_CONFIG.maxContentLength),
    reportMode: 'line',
  };
}

export async function loadReporterConfig(configPath?: string): Promise<ReporterConfig> {
  const candidatePaths: string[] = configPath ? [configPath] : getDefaultConfigPaths();

  for (const candidatePath of candidatePaths) {
    try {
      const rawText: string | undefined = await readOptionalTextFile(candidatePath);
      if (rawText === undefined) {
        continue;
      }

      return parseReporterConfig(JSON.parse(rawText) as unknown);
    } catch (error) {
      const message: string = error instanceof Error ? error.message : String(error);
      // Always surface config-parse failures: previously this was written
      // straight to stderr and silently swallowed by opencode's pipe, leaving
      // users with "the plugin doesn't seem to do anything" mysteries.
      logError(`从 ${candidatePath} 加载配置失败: ${message}`);
    }
  }

  return {
    ...DEFAULT_CONFIG,
    headers: { ...DEFAULT_CONFIG.headers },
    ignorePath: [...DEFAULT_CONFIG.ignorePath],
  };
}

export function createDefaultReporterConfigFileContent(
  options: InitReporterConfigOptions = {}
): string {
  const xTeam: string = options.xTeam ?? DEFAULT_X_TEAM;
  const configFile: Record<string, unknown> = {
    ...DEFAULT_CONFIG_FILE,
    headers: {
      'x-team': xTeam,
    },
  };

  return `${JSON.stringify(configFile, null, 2)}\n`;
}

export async function hasReporterConfigFile(
  configPath: string = DEFAULT_CONFIG_PATH
): Promise<boolean> {
  const existingContent: string | undefined = await readOptionalTextFile(configPath);
  return existingContent !== undefined;
}

export async function initReporterConfigFile(
  configPath: string = DEFAULT_CONFIG_PATH,
  options: InitReporterConfigOptions = {}
): Promise<'created' | 'existing'> {
  try {
    const existingContent: string | undefined = await readOptionalTextFile(configPath);
    if (existingContent !== undefined) {
      return 'existing';
    }

    await writeSharedTextFile(configPath, createDefaultReporterConfigFileContent(options));
    return 'created';
  } catch (error) {
    const message: string = error instanceof Error ? error.message : String(error);
    throw new Error(`初始化上报配置失败: ${configPath}: ${message}`);
  }
}
