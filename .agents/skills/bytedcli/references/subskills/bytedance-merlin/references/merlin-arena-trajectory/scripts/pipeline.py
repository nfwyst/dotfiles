"""Exercise-level pipeline orchestration and batch download.

Glues together ``api`` (I/O) and ``normalize`` (data transformation) into
end-to-end per-exercise pipelines with retry logic and batch concurrency.
"""

from __future__ import annotations

import asyncio
import gc
import random
import sys
import time
from pathlib import Path
from typing import Any

from api import (
    get_call,
    get_trace,
    get_trajectory_detail,
    get_trajectory_meta,
    list_calls,
    list_cases,
)
from models import (
    NO_SAMPLE_TYPES,
    RETRY_BACKOFF,
    RETRY_MAX,
    SKIP_DETAIL_TYPES,
    NormalizedCall,
    extract_question_sid,
    safe_filename,
    write_jsonl,
)
from models import SIMPLIFY_MODE_WHITELIST
from normalize import (
    build_span_data,
    dedupe_model_call_retries,
    flatten_trace_tree,
    inject_session_nodes,
    reclassify_judge_model_calls,
    simplify_trajectory,
    simplify_trajectory_blacklist,
)

# ---------------------------------------------------------------------------
# Call detail enrichment
# ---------------------------------------------------------------------------


async def fetch_call_details(
    project_id: str,
    start_date: str,
    records: list[NormalizedCall],
    label: str = "",
    batch_size: int = 0,
) -> list[NormalizedCall]:
    """Enrich records in-place via async batch ListCalls."""
    need_ids = [r.call_id for r in records if r.type not in SKIP_DETAIL_TYPES]
    if not need_ids:
        return records

    prefix = f"  [{label}] " if label else "  "
    print(f"{prefix}Fetching call details ({len(need_ids)} calls)...", flush=True)
    t0 = time.monotonic()

    list_calls_kwargs: dict = {}
    if batch_size > 0:
        list_calls_kwargs["batch_size"] = batch_size

    try:
        details = await list_calls(project_id, need_ids, **list_calls_kwargs)
    except Exception as e:
        print(
            f"{prefix}Warning: ListCalls failed, falling back to concurrent GetCall: {e}",
            file=sys.stderr,
        )
        details = {}
        done_fb = 0
        total_fb = len(need_ids)
        log_fb = max(1, total_fb // 10)

        async def _get_one(cid: str) -> None:
            nonlocal done_fb
            try:
                details[cid] = await get_call(project_id, cid, start_date)
            except Exception:
                pass
            done_fb += 1
            if done_fb % log_fb == 0 or done_fb == total_fb:
                print(f"{prefix}  GetCall fallback {done_fb}/{total_fb}", flush=True)

        await asyncio.gather(*(_get_one(cid) for cid in need_ids))

    fetched = 0
    for rec in records:
        if rec.type in SKIP_DETAIL_TYPES:
            continue
        detail = details.pop(rec.call_id, None)
        if detail is None:
            continue
        fetched += 1
        content = detail.get("Content") or {}
        rec.span_data = build_span_data(rec.type, content)
        rec.tokens = detail.get("tokens") or rec.tokens
        rec.source_code_link = detail.get("func_code_url") or rec.source_code_link
        if isinstance(content, dict) and content.get("Exception"):
            rec.exception = str(content["Exception"])
        del detail, content
    del details
    elapsed = time.monotonic() - t0
    if fetched < len(need_ids):
        print(
            f"{prefix}ListCalls returned {fetched}/{len(need_ids)} calls ({elapsed:.1f}s)",
            file=sys.stderr,
        )
    else:
        print(
            f"{prefix}Call details fetched: {fetched} calls ({elapsed:.1f}s)",
            flush=True,
        )
    return records


# ---------------------------------------------------------------------------
# Single exercise pipeline
# ---------------------------------------------------------------------------


async def pipeline_exercise(
    arena_evaluation_sid: str,
    exercise_version_sid: str,
    exercise_name: str,
    traj_dir: Path,
    model_name: str,
    cases_per_exercise: int = 0,
    do_fetch_call_details: bool = False,
    simplify_mode: str | None = None,
    simplify_types: set[str] | None = None,
    batch_size: int = 0,
    retries: int = RETRY_MAX,
) -> Path | None:
    """Full pipeline with retries — async-sleep between attempts."""
    tag = exercise_name[:60]
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            return await _pipeline_exercise_once(
                arena_evaluation_sid,
                exercise_version_sid,
                exercise_name,
                traj_dir,
                model_name,
                cases_per_exercise,
                do_fetch_call_details,
                simplify_mode,
                simplify_types,
                batch_size,
            )
        except Exception as e:
            last_err = e
            if attempt < retries:
                wait = RETRY_BACKOFF[min(attempt - 1, len(RETRY_BACKOFF) - 1)]
                print(
                    f"  [{tag}] attempt {attempt}/{retries} failed: {e}; "
                    f"retrying in {wait}s...",
                    flush=True,
                )
                await asyncio.sleep(wait)
    print(
        f"  [{tag}] failed after {retries} attempts: {last_err}",
        file=sys.stderr,
    )
    return None


async def _pipeline_exercise_once(
    arena_evaluation_sid: str,
    exercise_version_sid: str,
    exercise_name: str,
    traj_dir: Path,
    model_name: str,
    cases_per_exercise: int = 0,
    do_fetch_call_details: bool = False,
    simplify_mode: str | None = None,
    simplify_types: set[str] | None = None,
    batch_size: int = 0,
) -> Path | None:
    """Single attempt of the exercise pipeline."""
    tag = exercise_name[:60]

    case_limit = cases_per_exercise if cases_per_exercise > 0 else 1
    meta_coro = get_trajectory_meta(arena_evaluation_sid, exercise_version_sid)
    cases_coro = list_cases(arena_evaluation_sid, exercise_version_sid, case_limit)
    meta_result, cases_result = await asyncio.gather(
        meta_coro, cases_coro, return_exceptions=True
    )

    if isinstance(meta_result, Exception):
        raise meta_result
    meta = meta_result
    if not model_name:
        model_name = meta.model_name

    if isinstance(cases_result, Exception):
        raise cases_result
    cases: list[dict[str, Any]] = cases_result
    if not cases:
        print(f"  [{tag}] no cases found", file=sys.stderr)
        return None
    total_cases = len(cases)

    if 0 < cases_per_exercise < len(cases):
        cases = random.sample(cases, cases_per_exercise)
        print(f"  [{tag}] sampled {cases_per_exercise}/{total_cases} cases", flush=True)

    first_qsid = extract_question_sid(cases[0])
    if not first_qsid:
        print(f"  [{tag}] no question_sid", file=sys.stderr)
        return None

    detail = await get_trajectory_detail(
        first_qsid, exercise_version_sid, arena_evaluation_sid, model_name, 0
    )
    trace = await get_trace(
        detail.project_id,
        detail.trace_id,
        detail.sample_started_at,
        detail.instance_ended_at,
    )
    if not trace:
        print(f"  [{tag}] empty trace", file=sys.stderr)
        return None

    records = flatten_trace_tree(trace, exercise_name, exercise_version_sid)
    records = inject_session_nodes(records, trace_root=trace)
    records = reclassify_judge_model_calls(records)
    del trace

    if cases_per_exercise > 0:
        keep_qsids = {extract_question_sid(c) for c in cases} - {None}
        records = [
            r
            for r in records
            if r.sample_internal_uuid in keep_qsids
            or r.type in NO_SAMPLE_TYPES
        ]
    del cases, meta

    if simplify_mode:
        records = dedupe_model_call_retries(records)

    if simplify_mode == SIMPLIFY_MODE_WHITELIST and simplify_types:
        records = simplify_trajectory(records, simplify_types)
    elif simplify_mode:
        records = simplify_trajectory_blacklist(records)

    if do_fetch_call_details:
        start_date = time.strftime(
            "%Y%m%d", time.gmtime(detail.sample_started_at / 1000)
        )
        records = await fetch_call_details(
            detail.project_id, start_date, records, label=tag,
            batch_size=batch_size,
        )

    out_path = traj_dir / f"{safe_filename(exercise_name)}.jsonl"
    write_jsonl(records, out_path)
    n = len(records)
    del records
    print(f"  [{tag}] {n} calls -> {out_path.name}", flush=True)
    return out_path


# ---------------------------------------------------------------------------
# Batch orchestration
# ---------------------------------------------------------------------------


async def batch_fetch_all(
    arena_evaluation_sid: str,
    exercises: list[tuple[str, str]],
    traj_dir: Path,
    concurrency: int = 10,
    model_name: str = "",
    cases_per_exercise: int = 0,
    do_fetch_call_details: bool = False,
    simplify_mode: str | None = None,
    simplify_types: set[str] | None = None,
    batch_size: int = 0,
) -> list[Path]:
    existing = {f.stem for f in traj_dir.glob("*.jsonl")}
    todo = [
        (n, s)
        for n, s in exercises
        if safe_filename(n) not in existing
    ]
    skipped = len(exercises) - len(todo)
    if skipped:
        print(f"[Resume] skipping {skipped} already-downloaded exercises", flush=True)
    if not todo:
        return []

    sem = asyncio.Semaphore(concurrency)
    total = len(todo)
    done = 0
    ok = 0
    fail = 0
    t0 = time.monotonic()

    async def _run(ename: str, evsid: str) -> Path | None:
        nonlocal done, ok, fail
        async with sem:
            result = await pipeline_exercise(
                arena_evaluation_sid,
                evsid,
                ename,
                traj_dir,
                model_name,
                cases_per_exercise,
                do_fetch_call_details,
                simplify_mode,
                simplify_types,
                batch_size,
            )
        done += 1
        if result:
            ok += 1
        else:
            fail += 1
        gc.collect()
        elapsed = time.monotonic() - t0
        eta = (elapsed / done) * (total - done)
        print(
            f"[Progress] {done}/{total} remaining "
            f"(ok={ok} fail={fail}) "
            f"elapsed={elapsed:.0f}s eta={eta:.0f}s",
            flush=True,
        )
        return result

    results = await asyncio.gather(*(_run(n, s) for n, s in todo))
    return [p for p in results if p is not None]
