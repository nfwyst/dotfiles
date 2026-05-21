import { appendFile, mkdir, readFile, stat, writeFile } from 'fs/promises';
import path from 'path';
import { ensureTrailingNewline } from './text.ts';
import { isRecord } from './value.ts';

/**
 * Hard cap for "optional text file" reads. Telemetry never benefits from
 * scanning multi-megabyte blobs, and unbounded reads have caused OOM-style
 * issues when the AI accidentally creates giant generated files. Callers that
 * legitimately need to read large files should call `readFile` directly.
 */
const MAX_OPTIONAL_TEXT_FILE_BYTES: number = 1024 * 1024;

function formatFileError(prefix: string, filePath: string, error: unknown): Error {
  const message: string = error instanceof Error ? error.message : String(error);
  return new Error(`${prefix}: ${filePath}: ${message}`);
}

export async function readOptionalTextFile(
  filePath: string,
  label = '读取文件失败',
  maxBytes: number = MAX_OPTIONAL_TEXT_FILE_BYTES
): Promise<string | undefined> {
  try {
    if (Number.isFinite(maxBytes) && maxBytes > 0) {
      try {
        const info = await stat(filePath);
        if (info.size > maxBytes) {
          return undefined;
        }
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          return undefined;
        }
        // stat failed for non-ENOENT reasons (e.g. permission). Fall through
        // to readFile so the existing error-mapping below still applies.
      }
    }

    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }

    throw formatFileError(label, filePath, error);
  }
}

export async function readTextFileOrEmpty(
  filePath: string,
  label = '读取文件失败'
): Promise<string> {
  return (await readOptionalTextFile(filePath, label)) ?? '';
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, ensureTrailingNewline(content), 'utf8');
}

export async function appendTextFile(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, ensureTrailingNewline(content), 'utf8');
}

export async function readJsonObjectFile<T extends Record<string, unknown>>(
  filePath: string,
  label: string,
  fallback: T
): Promise<T> {
  const content: string | undefined = await readOptionalTextFile(filePath, label);
  if (content === undefined) {
    return fallback;
  }

  try {
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed)) {
      throw new Error('JSON 必须是对象。');
    }

    return parsed as T;
  } catch (error) {
    const message: string = error instanceof Error ? error.message : String(error);
    throw new Error(`${label}: ${filePath}: ${message}`);
  }
}
