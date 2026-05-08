#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple


_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
_CTRL_RE = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")


_ERROR_RE = re.compile(r"\b(error|exception|traceback|fatal|panic|segfault|signal)\b", re.IGNORECASE)
_WARN_RE = re.compile(r"\b(warn|warning)\b", re.IGNORECASE)
_OOM_RE = re.compile(r"\b(oom|out of memory|cuda.*out of memory|cudnn|nccl|killed|sigkill)\b", re.IGNORECASE)
_PROGRESS_RE = re.compile(r"\b(epoch|step|iter|iteration|global_step|progress|eta)\b", re.IGNORECASE)
_METRIC_RE = re.compile(r"\b(loss|acc|accuracy|eval|val|precision|recall|f1|auc|lr|learning rate)\b", re.IGNORECASE)
_CKPT_RE = re.compile(r"\b(ckpt|checkpoint|saving|save|load)\b", re.IGNORECASE)


@dataclass(frozen=True)
class CompressConfig:
    head: int
    tail: int
    context: int
    max_lines: int
    max_bytes: int
    strip_ansi: bool


@dataclass(frozen=True)
class IncrementalState:
    anchor: str
    total_bytes: int


def _is_url(s: str) -> bool:
    return s.startswith("http://") or s.startswith("https://")


def _read_text(source: str, timeout_s: int, max_bytes: int, disable_proxy: bool) -> str:
    if _is_url(source):
        return _download_text(source, timeout_s=timeout_s, max_bytes=max_bytes, disable_proxy=disable_proxy)
    if source.startswith("file://"):
        p = Path(source[len("file://") :])
        return p.read_text(encoding="utf-8", errors="replace")
    p = Path(source)
    if p.exists():
        return p.read_text(encoding="utf-8", errors="replace")
    raise RuntimeError("log source must be http(s) url or existing file path")


def _build_opener(disable_proxy: bool) -> urllib.request.OpenerDirector:
    if disable_proxy:
        return urllib.request.build_opener(urllib.request.ProxyHandler({}))
    return urllib.request.build_opener()


def _download_text(url: str, timeout_s: int, max_bytes: int, disable_proxy: bool) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "job-log-downloader/1.0",
            "Accept": "text/plain,*/*",
        },
        method="GET",
    )
    opener = _build_opener(disable_proxy=disable_proxy)
    with opener.open(req, timeout=timeout_s) as resp:
        chunks: List[bytes] = []
        total = 0
        while True:
            part = resp.read(1024 * 64)
            if not part:
                break
            chunks.append(part)
            total += len(part)
            if total > max_bytes:
                break
        raw = b"".join(chunks)
    return raw.decode("utf-8", errors="replace")


def _sanitize_line(line: str, strip_ansi: bool) -> str:
    s = line.rstrip("\n")
    if strip_ansi:
        s = _ANSI_RE.sub("", s)
    s = _CTRL_RE.sub("", s)
    return s


def _classify(line: str) -> int:
    score = 0
    if _ERROR_RE.search(line):
        score += 100
    if _OOM_RE.search(line):
        score += 90
    if _WARN_RE.search(line):
        score += 50
    if _CKPT_RE.search(line):
        score += 35
    if _METRIC_RE.search(line):
        score += 30
    if _PROGRESS_RE.search(line):
        score += 20
    if "nan" in line.lower() or "inf" in line.lower():
        score += 20
    if "http" in line.lower():
        score += 5
    return score


def _expand_with_context(indices: Set[int], n: int, context: int) -> Set[int]:
    if context <= 0:
        return set(indices)
    out = set(indices)
    for i in list(indices):
        for d in range(1, context + 1):
            if i - d >= 0:
                out.add(i - d)
            if i + d < n:
                out.add(i + d)
    return out


def _pick_indices(lines: Sequence[str], cfg: CompressConfig) -> List[int]:
    n = len(lines)
    if n == 0:
        return []

    head_n = min(cfg.head, max(cfg.max_lines // 3, 0))
    tail_n = min(cfg.tail, max(cfg.max_lines - head_n, 0))

    keep: Set[int] = set()
    for i in range(min(head_n, n)):
        keep.add(i)
    for i in range(max(0, n - tail_n), n):
        keep.add(i)

    scored: List[Tuple[int, int]] = []
    for i, line in enumerate(lines):
        score = _classify(line)
        if score > 0:
            scored.append((score, i))

    scored.sort(reverse=True)
    for score, i in scored[: max(cfg.max_lines * 2, 200)]:
        keep.add(i)

    keep = _expand_with_context(keep, n=n, context=cfg.context)
    indices = sorted(keep)

    if len(indices) <= cfg.max_lines:
        return indices

    must_keep: Set[int] = set()
    for i in range(min(head_n, n)):
        must_keep.add(i)
    for i in range(max(0, n - tail_n), n):
        must_keep.add(i)
    must_keep = _expand_with_context(must_keep, n=n, context=cfg.context)

    candidates: List[Tuple[int, int]] = []
    for i in indices:
        if i in must_keep:
            continue
        candidates.append((_classify(lines[i]), i))

    candidates.sort(key=lambda t: (t[0], t[1]), reverse=True)
    budget = max(cfg.max_lines - len(must_keep), 0)
    chosen_extra = {i for _, i in candidates[:budget]}
    final = sorted(must_keep | chosen_extra)
    return final[: cfg.max_lines]


def _compress_text(text: str, cfg: CompressConfig) -> Tuple[str, int, int]:
    raw_lines = text.splitlines()
    lines = [_sanitize_line(line, strip_ansi=cfg.strip_ansi) for line in raw_lines]
    indices = _pick_indices(lines, cfg=cfg)
    compressed_lines = [lines[i] for i in indices]
    return ("\n".join(compressed_lines) + ("\n" if compressed_lines else ""), len(lines), len(compressed_lines))


def _ensure_pairs(args: Sequence[str]) -> List[Tuple[str, str]]:
    if len(args) == 0 or len(args) % 2 != 0:
        raise RuntimeError("USAGE: download_and_compress_logs.py JOB1 URL1 [JOB2 URL2 ...]")
    pairs: List[Tuple[str, str]] = []
    it = iter(args)
    for job in it:
        url = next(it)
        pairs.append((job, url))
    return pairs


def _safe_name(name: str) -> str:
    s = re.sub(r"[^\w.\-]+", "_", name.strip())
    return s[:120] if len(s) > 120 else s


def _state_path(state_dir: Path, job_name: str) -> Path:
    return state_dir / f"{job_name}.json"


def _read_state(state_dir: Path, job_name: str) -> Optional[IncrementalState]:
    p = _state_path(state_dir, job_name)
    if not p.exists():
        return None
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        anchor = str(data.get("anchor", ""))
        total_bytes = int(data.get("total_bytes", 0))
        if not anchor:
            return None
        return IncrementalState(anchor=anchor, total_bytes=max(total_bytes, 0))
    except Exception:
        return None


def _write_state(state_dir: Path, job_name: str, anchor: str, total_bytes: int) -> None:
    state_dir.mkdir(parents=True, exist_ok=True)
    p = _state_path(state_dir, job_name)
    payload = {
        "anchor": anchor,
        "total_bytes": int(total_bytes),
        "updated_at": int(time.time()),
    }
    p.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def _compute_delta(text: str, prev: Optional[IncrementalState]) -> Tuple[str, bool, int]:
    if not prev or not prev.anchor:
        return text, False, 0
    idx = text.rfind(prev.anchor)
    if idx < 0:
        return text, False, 0
    start = idx + len(prev.anchor)
    if start < 0 or start > len(text):
        return text, False, 0
    delta = text[start:]
    return delta, True, start


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Download job logs and produce a compressed snippet.")
    parser.add_argument("pairs", nargs="+", help="JOB URL pairs: JOB1 URL1 [JOB2 URL2 ...]")
    parser.add_argument("--out-dir", default="./logs", help="directory to save logs (default: ./logs)")
    parser.add_argument("--state-dir", default=None, help="state directory for incremental monitoring (default: <out-dir>/.state)")
    parser.add_argument("--full", action="store_true", help="disable incremental mode and process full log")
    parser.add_argument("--timeout", type=int, default=30, help="download timeout seconds (default: 30)")
    parser.add_argument("--max-bytes", type=int, default=50 * 1024 * 1024, help="max bytes per log (default: 50MB)")

    parser.add_argument("--head", type=int, default=60, help="keep first N lines (default: 60)")
    parser.add_argument("--tail", type=int, default=160, help="keep last N lines (default: 160)")
    parser.add_argument("--context", type=int, default=2, help="context lines around key lines (default: 2)")
    parser.add_argument("--max-lines", type=int, default=400, help="max lines in compressed snippet (default: 400)")
    parser.add_argument("--anchor-bytes", type=int, default=4096, help="anchor bytes kept in state (default: 4096)")
    parser.add_argument("--keep-ansi", action="store_true", help="keep ANSI escapes (default: strip)")
    parser.add_argument("--use-proxy", action="store_true", help="use proxy env vars (default: disabled)")

    args = parser.parse_args(argv)
    pairs = _ensure_pairs(args.pairs)

    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    state_dir = Path(args.state_dir).expanduser().resolve() if args.state_dir else (out_dir / ".state")
    state_dir.mkdir(parents=True, exist_ok=True)

    cfg = CompressConfig(
        head=max(args.head, 0),
        tail=max(args.tail, 0),
        context=max(args.context, 0),
        max_lines=max(args.max_lines, 1),
        max_bytes=max(args.max_bytes, 1024),
        strip_ansi=not args.keep_ansi,
    )

    print(f"BEGIN_BATCH jobs={len(pairs)} out_dir={out_dir}")
    for job, url in pairs:
        job_name = _safe_name(job)
        saved_path = out_dir / f"{job_name}.log"
        compressed_path = out_dir / f"{job_name}.compressed.log"
        delta_compressed_path = out_dir / f"{job_name}.delta.compressed.log"

        status = "OK"
        original_lines = 0
        compressed_lines = 0
        delta_original_lines = 0
        delta_compressed_lines = 0
        compressed_text = ""
        delta_compressed_text = ""
        anchor_hit = False
        delta_start_byte = 0

        try:
            text = _read_text(url, timeout_s=args.timeout, max_bytes=cfg.max_bytes, disable_proxy=not args.use_proxy)
            saved_path.write_text(text, encoding="utf-8")
            prev_state = None if args.full else _read_state(state_dir, job_name)
            delta_text, anchor_hit, delta_start_byte = _compute_delta(text, prev_state)
            compressed_text, original_lines, compressed_lines = _compress_text(text, cfg=cfg)
            delta_compressed_text, delta_original_lines, delta_compressed_lines = _compress_text(delta_text, cfg=cfg)
            compressed_path.write_text(compressed_text, encoding="utf-8")
            delta_compressed_path.write_text(delta_compressed_text, encoding="utf-8")
            anchor = text[-max(args.anchor_bytes, 1) :]
            _write_state(state_dir, job_name, anchor=anchor, total_bytes=len(text))
        except Exception as exc:  # noqa: BLE001
            status = f"ERROR:{type(exc).__name__}"
            compressed_text = str(exc) + "\n"
            delta_compressed_text = compressed_text
            compressed_path.write_text(compressed_text, encoding="utf-8")
            delta_compressed_path.write_text(delta_compressed_text, encoding="utf-8")

        print("---")
        print(f"JOB: {job}")
        print(f"URL: {url}")
        print(f"STATUS: {status}")
        print(f"SAVED_LOG: {saved_path if saved_path.exists() else '-'}")
        print(f"SAVED_COMPRESSED: {compressed_path}")
        print(f"SAVED_DELTA_COMPRESSED: {delta_compressed_path}")
        print(f"INCREMENTAL: {'0' if args.full else '1'}")
        print(f"ANCHOR_HIT: {'1' if anchor_hit else '0'}")
        print(f"DELTA_START_BYTE: {delta_start_byte}")
        print(f"ORIGINAL_LINES: {original_lines}")
        print(f"COMPRESSED_LINES: {compressed_lines}")
        print(f"DELTA_ORIGINAL_LINES: {delta_original_lines}")
        print(f"DELTA_COMPRESSED_LINES: {delta_compressed_lines}")
        print("COMPRESSED_DELTA_LOG_START")
        sys.stdout.write(delta_compressed_text)
        if not delta_compressed_text.endswith("\n"):
            sys.stdout.write("\n")
        print("COMPRESSED_DELTA_LOG_END")

    print("END_BATCH")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
