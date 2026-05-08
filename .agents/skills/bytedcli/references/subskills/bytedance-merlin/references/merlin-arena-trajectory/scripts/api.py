"""Async merlin-cli subprocess client and all platform API wrappers.

Every function in this module ultimately calls merlin-cli as an async
subprocess.  A module-level semaphore (initialised via ``init_semaphore``)
caps concurrency to avoid fd/memory exhaustion.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Sequence

from models import (
    CLI_MAX_CONCURRENT,
    LIST_CALLS_BATCH_SIZE,
    RETRY_BACKOFF,
    RETRY_MAX,
    TIME_BUFFER_MS,
    TrajectoryDetail,
    TrajectoryMeta,
)

# ---------------------------------------------------------------------------
# Global concurrency limiter — call init_semaphore() once before any I/O.
# ---------------------------------------------------------------------------

_cli_sem: asyncio.Semaphore | None = None


def init_semaphore(max_concurrent: int = CLI_MAX_CONCURRENT) -> None:
    global _cli_sem
    _cli_sem = asyncio.Semaphore(max_concurrent)


# ---------------------------------------------------------------------------
# Subprocess helper
# ---------------------------------------------------------------------------


async def merlin_cli_async(
    args: Sequence[str], *, retries: int = RETRY_MAX
) -> dict[str, Any]:
    """Run merlin-cli as async subprocess with retries and global concurrency limit."""
    cmd = ("merlin-cli", *args)
    sem = _cli_sem or asyncio.Semaphore(CLI_MAX_CONCURRENT)
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        async with sem:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout_bytes, stderr_bytes = await proc.communicate()
        if proc.returncode == 0:
            out = stdout_bytes.decode().strip()
            if out:
                return json.loads(out)
            last_err = RuntimeError(f"merlin-cli empty output: {' '.join(cmd)}")
        else:
            last_err = RuntimeError(
                f"merlin-cli failed (rc={proc.returncode}): {' '.join(cmd)}\n"
                f"{stderr_bytes.decode().strip()}"
            )
        if attempt < retries:
            wait = RETRY_BACKOFF[min(attempt - 1, len(RETRY_BACKOFF) - 1)]
            print(f"    [retry {attempt}/{retries}] waiting {wait}s...", flush=True)
            await asyncio.sleep(wait)
    raise last_err  # type: ignore[misc]


# ---------------------------------------------------------------------------
# High-level API functions
# ---------------------------------------------------------------------------


async def get_trajectory_meta(
    arena_evaluation_sid: str, exercise_version_sid: str
) -> TrajectoryMeta:
    data = await merlin_cli_async([
        "insight", "get-trajectory-trial-meta-info", "--json",
        json.dumps({
            "arena_evaluation_sid": arena_evaluation_sid,
            "exercise_version_sid": exercise_version_sid,
        }),
    ])
    evals = data.get("insight_arena_evaluations", [])
    if not evals:
        raise RuntimeError("No insight_arena_evaluations returned")
    first = evals[0]
    iae = first.get("insight_arena_evaluation", {})
    return TrajectoryMeta(
        arena_evaluation_sid=iae.get("arena_evaluation_sid", arena_evaluation_sid),
        model_name=iae.get("name", ""),
        max_trial_num=int(first.get("max_trial_num", 1)),
        exercise_name=data.get("exercise_name", ""),
        exercise_version_link=data.get("exercise_version_link", ""),
    )


async def get_trajectory_detail(
    question_sid: str,
    exercise_version_sid: str,
    arena_evaluation_sid: str,
    model_name: str,
    trial_num: int = 0,
) -> TrajectoryDetail:
    data = await merlin_cli_async([
        "insight", "get-trajectory-detail", "--json",
        json.dumps({
            "arena_evaluation_sid": arena_evaluation_sid,
            "exercise_version_sid": exercise_version_sid,
            "question_sid": question_sid,
            "trial_num": str(trial_num),
        }),
    ])
    raw = data.get("weave_call_info_json", "")
    if not raw:
        raise RuntimeError("Empty weave_call_info_json in trajectory detail response")
    info = json.loads(raw)
    inst = info.get("instance_node_id", {})
    samp = info.get("sample_node_id", {})
    return TrajectoryDetail(
        project_id=info.get("project_id", ""),
        trace_id=inst.get("trace_id", ""),
        instance_call_id=inst.get("call_id", ""),
        sample_call_id=samp.get("call_id", ""),
        instance_started_at=int(inst.get("started_at", 0)),
        instance_ended_at=int(inst.get("ended_at", 0)),
        sample_started_at=int(samp.get("started_at", 0)),
        sample_ended_at=int(samp.get("ended_at", 0)),
        instance_url=inst.get("url", ""),
        sample_url=samp.get("url", ""),
        session_threads=info.get("infer_session_threads", {}),
        session_urls=info.get("infer_session_urls", {}),
    )


async def get_trace(
    project_id: str, trace_id: str, start_time: int, end_time: int
) -> dict[str, Any]:
    data = await merlin_cli_async([
        "tracking", "get-weave-trace", "--json",
        json.dumps({
            "project_id": project_id,
            "trace_id": trace_id,
            "time_range": {
                "StartTime": start_time - TIME_BUFFER_MS,
                "EndTime": end_time + TIME_BUFFER_MS,
            },
        }),
    ])
    return data.get("Result", {}).get("Trace", {})


async def list_cases(
    arena_evaluation_sid: str,
    exercise_version_sid: str,
    limit: int = 0,
) -> list[dict[str, Any]]:
    fetch_limit = limit if limit > 0 else 200
    data = await merlin_cli_async([
        "arena", "list-case", "--json",
        json.dumps({
            "evaluation_instance_sid": arena_evaluation_sid,
            "exercise_version_sid": exercise_version_sid,
            "limit": fetch_limit,
        }),
    ])
    return data.get("case", [])


async def get_exercises_from_arena(
    arena_evaluation_sid: str,
) -> list[tuple[str, str]]:
    data = await merlin_cli_async([
        "arena", "get-evaluation", "--json",
        json.dumps({"sid": arena_evaluation_sid}),
    ])
    progress = (
        (data.get("arena_evaluation") or data.get("evaluation") or {})
        .get("progress", {})
        .get("detail", {})
    )
    return [
        (str(key), str(val["exercise_version_sid"]))
        for key, val in progress.items()
        if isinstance(val, dict) and val.get("exercise_version_sid")
    ]


# ---------------------------------------------------------------------------
# ListCalls / GetCall — batch detail fetching
# ---------------------------------------------------------------------------


async def _list_calls_chunk(
    project_id: str, chunk: list[str]
) -> list[dict[str, Any]]:
    """Fetch a chunk of calls; adaptively split on 502 (both halves concurrent)."""
    try:
        data = await merlin_cli_async([
            "tracking", "list-weave-calls", "--json",
            json.dumps({"project_id": project_id, "filter": {"call_ids": chunk}}),
        ])
        return data.get("Calls", []) or data.get("Result", {}).get("Calls", [])
    except RuntimeError as e:
        if "502" not in str(e) or len(chunk) <= 1:
            raise
        half = len(chunk) // 2
        print(f"    502 on {len(chunk)} ids, splitting 2×{half}", flush=True)
        left, right = await asyncio.gather(
            _list_calls_chunk(project_id, chunk[:half]),
            _list_calls_chunk(project_id, chunk[half:]),
        )
        return left + right


async def list_calls(
    project_id: str,
    call_ids: list[str],
    batch_size: int = LIST_CALLS_BATCH_SIZE,
) -> dict[str, dict[str, Any]]:
    """Batch-fetch call details via concurrent async chunks."""
    if not call_ids:
        return {}

    chunks = [
        call_ids[i : i + batch_size]
        for i in range(0, len(call_ids), batch_size)
    ]
    total = len(chunks)
    result: dict[str, dict[str, Any]] = {}
    done = 0
    log_interval = max(1, total // 5)

    async def _fetch(chunk: list[str]) -> None:
        nonlocal done
        calls = await _list_calls_chunk(project_id, chunk)
        for c in calls:
            if isinstance(c, dict) and (cid := c.get("CallID")):
                result[cid] = c
        done += 1
        if total > 1 and (done % log_interval == 0 or done == total):
            print(f"    ListCalls {done}/{total} chunks", flush=True)

    await asyncio.gather(*(_fetch(ch) for ch in chunks))
    return result


async def get_call(
    project_id: str, call_id: str, start_date: str
) -> dict[str, Any]:
    """Single call detail — fallback when ListCalls fails."""
    data = await merlin_cli_async([
        "tracking", "get-weave-call", "--json",
        json.dumps({
            "project_id": project_id,
            "call_id": call_id,
            "start_date": start_date,
        }),
    ])
    return data.get("Result", {}).get("Call", {})
