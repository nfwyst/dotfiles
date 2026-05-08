#!/usr/bin/env python3
"""Compute hash from HDFS checkpoint paths.

Mirrors the HashCkptPath logic in seed/titan: optionally normalise NonTT
prefixes back to TT prefixes via MERLIN_HDFS_HASH_MAPPING_JSON, then SHA-256
the result.

The same function is used for both dir_hash and ckpt_hash — the only
difference is which path you feed in (directory vs checkpoint).
"""

import argparse
import hashlib
import json
import os
from typing import List, Optional, Sequence


def hdfs_mapping() -> dict[str, str]:
    raw = os.environ.get("MERLIN_HDFS_HASH_MAPPING_JSON", "{}").strip()
    if not raw:
        return {}
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError("MERLIN_HDFS_HASH_MAPPING_JSON must be a JSON object")
    return {str(key): str(value) for key, value in parsed.items()}


def nontt_to_tt(path: str) -> str:
    """Replace NonTT HDFS prefix with the canonical TT prefix (for hashing only)."""
    for nontt, tt in hdfs_mapping().items():
        if path.startswith(nontt):
            return path.replace(nontt, tt, 1)
    return path


def hash_ckpt_path(path: str) -> str:
    """Return the 64-char lowercase hex SHA-256 of the normalised path."""
    return hashlib.sha256(nontt_to_tt(path).encode()).hexdigest()


def main(argv: Optional[Sequence[str]] = None) -> int:
    p = argparse.ArgumentParser(
        description="Compute hash from HDFS checkpoint path(s). "
        "Works for both directory paths (→ dir_hash) and checkpoint paths (→ ckpt_hash)."
    )
    p.add_argument("paths", nargs="+", help="One or more HDFS paths")
    args = p.parse_args(argv)

    results: List[dict] = []
    for raw in args.paths:
        path = raw.strip()
        results.append({"path": path, "hash": hash_ckpt_path(path)})

    print(json.dumps({"results": results}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
