const BOM: string = '﻿';

export function stripBom(content: string): string {
  return content.startsWith(BOM) ? content.slice(BOM.length) : content;
}

export function normalizeNewlines(content: string): string {
  // Order matters: handle CRLF first, then any remaining standalone CR
  // (old-Mac line endings, mixed-encoding files saved through Windows tools).
  return stripBom(content).replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

export function splitNormalizedLines(content: string): string[] {
  return normalizeNewlines(content).split('\n');
}

export function trimTrailingLineBreaks(content: string): string {
  return normalizeNewlines(content).replace(/[\r\n]+$/, '');
}

export function ensureTrailingNewline(content: string): string {
  return content.endsWith('\n') ? content : `${content}\n`;
}
