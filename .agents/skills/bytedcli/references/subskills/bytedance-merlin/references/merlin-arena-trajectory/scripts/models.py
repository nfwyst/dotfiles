"""Data classes, constants, regex patterns, and shared utilities.

This module has zero external dependencies beyond the stdlib and is imported
by every other module in the package.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TIME_BUFFER_MS = 3_600_000
RETRY_MAX = 3
RETRY_BACKOFF = (1, 2, 5)
LIST_CALLS_BATCH_SIZE = 200

CLI_MAX_CONCURRENT = 30

SIMPLIFY_DEFAULT_TYPES = "instance,instance_loop,session,instance_metrics,model_call,judge_model_call"

SIMPLIFY_MODE_BLACKLIST = "blacklist"
SIMPLIFY_MODE_WHITELIST = "whitelist"

METRICS_ANCESTOR_TYPES: frozenset[str] = frozenset({
    "instance_metrics", "sample_metrics", "exercise_metrics",
})

SIMPLIFY_BLACKLIST: frozenset[str] = frozenset({
    "chat_completion",
    "model_preprocess",
    "model_postprocess",
    "model",
    "[Swalm] llm",
    "[Swalm] Model Preprocess",
    "[Swalm] Model Postprocess",
})

SIMPLIFY_BLACKLIST_SUBTREE: frozenset[str] = frozenset({
    "model_preprocess",
    "[Swalm] Model Preprocess",
})

# ---------------------------------------------------------------------------
# Pre-compiled patterns
# ---------------------------------------------------------------------------

RE_UUID = re.compile(
    r"\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b"
)
RE_INDEX = re.compile(r"index-?(\d+)", re.IGNORECASE)
RE_SESSION = re.compile(r"\[session-([^\]]+)\]")
RE_SID = re.compile(r"^[a-z0-9]{10,64}$")
RE_SAFE = re.compile(r"[^\w.\-]+")

# ---------------------------------------------------------------------------
# Frozen sets for fast membership checks
# ---------------------------------------------------------------------------

SKIP_DETAIL_TYPES = frozenset(
    {"exercise", "data_load", "model", "model_preprocess", "instance_loop", "session"}
)
NO_SAMPLE_TYPES = frozenset({"exercise", "data_load", "exercise_metrics"})
NO_INSTANCE_TYPES = frozenset({"sample", "sample_preprocess", "sample_metrics"})


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class TrajectoryMeta:
    arena_evaluation_sid: str
    model_name: str
    max_trial_num: int
    exercise_name: str
    exercise_version_link: str


@dataclass(slots=True)
class TrajectoryDetail:
    project_id: str
    trace_id: str
    instance_call_id: str
    sample_call_id: str
    instance_started_at: int
    instance_ended_at: int
    sample_started_at: int
    sample_ended_at: int
    instance_url: str
    sample_url: str
    session_threads: dict[str, str]
    session_urls: dict[str, str]


@dataclass(slots=True)
class NormalizedCall:
    call_id: str
    type: str
    exercise_name: str
    exercise_version_sid: str
    sample_internal_uuid: str | None
    instance_index: int | None
    started_at: int
    ended_at: int
    status: str
    exception: str | None
    span_data: dict[str, Any]
    children_call_ids: list[str]
    source_code_link: str | None
    tokens: int | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "call_id": self.call_id,
            "type": self.type,
            "exercise_name": self.exercise_name,
            "exercise_version_sid": self.exercise_version_sid,
            "sample_internal_uuid": self.sample_internal_uuid,
            "instance_index": self.instance_index,
            "started_at": self.started_at,
            "ended_at": self.ended_at,
            "status": self.status,
            "exception": self.exception,
            "span_data": self.span_data,
            "children_call_ids": self.children_call_ids,
            "source_code_link": self.source_code_link,
        }
        if self.tokens is not None:
            d["tokens"] = self.tokens
        return d


# ---------------------------------------------------------------------------
# URL / filename helpers
# ---------------------------------------------------------------------------


def extract_arena_sid(url_or_sid: str) -> str:
    s = url_or_sid.strip()
    if RE_SID.fullmatch(s):
        return s
    u = urlparse(s)
    qs = parse_qs(u.query or "")
    for key in ("evaluation_task_sid", "arena_evaluation_sid"):
        if sid := (qs.get(key) or [""])[0].strip():
            return sid
    parts = [p for p in u.path.split("/") if p]
    if len(parts) >= 3 and parts[-2] == "arena":
        return parts[-1]
    raise RuntimeError(f"Cannot extract arena_evaluation_sid from: {s}")


def safe_filename(name: str) -> str:
    return RE_SAFE.sub("_", name.strip())[:180]


def extract_question_sid(case_item: dict[str, Any]) -> str | None:
    payload_str = case_item.get("payload", "{}")
    payload_obj = (
        json.loads(payload_str) if isinstance(payload_str, str) else payload_str
    )
    qid = (
        case_item.get("question_id")
        or payload_obj.get("question_id")
        or payload_obj.get("__internal_uuid__")
    )
    if not qid:
        return None
    if m := RE_UUID.match(qid):
        return m.group(1)
    return qid


# ---------------------------------------------------------------------------
# I/O helpers
# ---------------------------------------------------------------------------


def write_jsonl(records: list[NormalizedCall], path: Path) -> None:
    """Write records to JSONL with 1 MB write buffer."""
    with path.open("w", encoding="utf-8", buffering=1_048_576) as f:
        for rec in records:
            f.write(json.dumps(rec.to_dict(), ensure_ascii=False))
            f.write("\n")
