#!/usr/bin/env python3
"""Arena Trajectory fetcher — CLI entry point.

Pull trace data from Seed platform via merlin-cli, normalize to structured
JSONL, and optionally generate interactive HTML visualization.

Module layout:
  models.py    — data classes, constants, regex, I/O helpers
  api.py       — async merlin-cli subprocess client + platform API wrappers
  normalize.py — tree normalization, session injection, pruning, simplification
  pipeline.py  — per-exercise pipeline orchestration and batch download
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
import types
from pathlib import Path
from typing import Any, Sequence

# dataclass on Python 3.10 does sys.modules[cls.__module__].__dict__ which
# fails when the script is loaded via exec() / importlib.
if __name__ not in sys.modules:
    sys.modules[__name__] = types.ModuleType(__name__)

from api import (
    get_exercises_from_arena,
    get_trace,
    get_trajectory_detail,
    get_trajectory_meta,
    init_semaphore,
)
from models import (
    LIST_CALLS_BATCH_SIZE,
    RE_UUID,
    SIMPLIFY_DEFAULT_TYPES,
    SIMPLIFY_MODE_BLACKLIST,
    SIMPLIFY_MODE_WHITELIST,
    NormalizedCall,
    extract_arena_sid,
    safe_filename,
    write_jsonl,
)
from normalize import (
    extract_instance_trajectory,
    flatten_trace_tree,
    inject_session_nodes,
    reclassify_judge_model_calls,
    simplify_trajectory,
    simplify_trajectory_blacklist,
)
from pipeline import batch_fetch_all, fetch_call_details


# ---------------------------------------------------------------------------
# Error report
# ---------------------------------------------------------------------------


def _print_error_report(records: list[NormalizedCall]) -> None:
    errors = [r for r in records if r.status not in ("success", "")]
    if not errors:
        print("  All nodes completed successfully.")
        return
    print(f"  Found {len(errors)} non-success node(s):")
    for r in errors:
        dur = ""
        if r.started_at and r.ended_at:
            ms = r.ended_at - r.started_at
            dur = f" ({ms}ms)" if ms < 1000 else f" ({ms / 1000:.1f}s)"
        exc = f" | exception: {r.exception[:120]}..." if r.exception else ""
        sample = (
            f" | sample={r.sample_internal_uuid[:12]}..."
            if r.sample_internal_uuid
            else ""
        )
        print(f"    [{r.status}] {r.type}{dur}{sample}{exc}")
        if r.source_code_link:
            print(f"      source: {r.source_code_link}")


# ---------------------------------------------------------------------------
# Async main
# ---------------------------------------------------------------------------


async def _async_main(args: argparse.Namespace) -> int:
    init_semaphore()

    arena_sid = extract_arena_sid(args.arena_evaluation_sid)
    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    jsonl_dir = out_dir / "trajectory"
    html_dir = out_dir / "html"
    jsonl_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Batch mode
    # ------------------------------------------------------------------
    if args.batch_all:
        print(f"Batch mode: arena_evaluation_sid={arena_sid}")
        exercises = await get_exercises_from_arena(arena_sid)
        if not exercises:
            print("No exercises found.", file=sys.stderr)
            return 1

        simplify_mode: str | None = None
        simplify_types: set[str] | None = None
        if args.simplify:
            simplify_mode = args.simplify_mode
            if simplify_mode == SIMPLIFY_MODE_WHITELIST:
                simplify_types = {t.strip() for t in args.simplify_types.split(",") if t.strip()}

        flags = []
        if args.fetch_call_details:
            flags.append("fetch-call-details=ON")
        if simplify_mode:
            mode_label = simplify_mode
            if simplify_mode == SIMPLIFY_MODE_WHITELIST and simplify_types:
                mode_label += f"({','.join(sorted(simplify_types))})"
            flags.append(f"simplify={mode_label}")
        if args.cases_per_exercise > 0:
            flags.append(f"cases-per-exercise={args.cases_per_exercise}")
        flags.append(f"concurrency={args.concurrency}")
        print(f"Found {len(exercises)} exercises ({', '.join(flags)})", flush=True)

        meta_obj: dict[str, Any] = {
            "arena_evaluation_sid": arena_sid,
            "exercises": [
                {"name": n, "exercise_version_sid": s} for n, s in exercises
            ],
            "cases_per_exercise": args.cases_per_exercise,
            "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }
        if simplify_mode:
            meta_obj["simplify_mode"] = simplify_mode
        if simplify_types:
            meta_obj["simplify_types"] = sorted(simplify_types)
        (out_dir / "meta.json").write_text(
            json.dumps(meta_obj, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        t0 = time.monotonic()
        paths = await batch_fetch_all(
            arena_sid,
            exercises,
            jsonl_dir,
            concurrency=args.concurrency,
            model_name=args.model_name,
            cases_per_exercise=args.cases_per_exercise,
            do_fetch_call_details=args.fetch_call_details,
            simplify_mode=simplify_mode,
            simplify_types=simplify_types,
            batch_size=args.batch_size,
        )
        elapsed = time.monotonic() - t0
        total_on_disk = len(list(jsonl_dir.glob("*.jsonl")))
        print(
            f"\nDone. {total_on_disk}/{len(exercises)} exercises in {jsonl_dir}/ "
            f"(this run: {len(paths)} new, {elapsed:.0f}s)"
        )
        return 0

    # ------------------------------------------------------------------
    # Single instance mode
    # ------------------------------------------------------------------
    if not args.exercise_version_sid:
        print(
            "--exercise-version-sid required for single trajectory mode",
            file=sys.stderr,
        )
        return 1
    if not args.question_sid:
        print("--question-sid required for single trajectory mode", file=sys.stderr)
        return 1

    qsid = args.question_sid
    if m := RE_UUID.match(qsid):
        qsid = m.group(1)

    print(f"Fetching trajectory meta for exercise={args.exercise_version_sid}...")
    meta = await get_trajectory_meta(arena_sid, args.exercise_version_sid)
    model_name = args.model_name or meta.model_name
    print(
        f"  Exercise: {meta.exercise_name}, model: {model_name}, "
        f"max_trial: {meta.max_trial_num}"
    )

    print(f"Fetching trajectory detail for question={qsid}, trial={args.trial_num}...")
    detail = await get_trajectory_detail(
        qsid, args.exercise_version_sid, arena_sid, model_name, args.trial_num
    )
    print(f"  project_id={detail.project_id}, trace_id={detail.trace_id}")

    print("Fetching trace tree...")
    trace = await get_trace(
        detail.project_id,
        detail.trace_id,
        detail.sample_started_at,
        detail.instance_ended_at,
    )

    print("Normalizing trace tree...")
    records = flatten_trace_tree(trace, meta.exercise_name, args.exercise_version_sid)
    records = inject_session_nodes(records, trace_root=trace)
    records = reclassify_judge_model_calls(records)
    start_date = trace.get("Call", {}).get("StartDate", "")
    del trace

    records = extract_instance_trajectory(records, qsid, args.trial_num)
    print(f"  Pruned to instance trajectory: {len(records)} calls")

    if args.simplify:
        if args.simplify_mode == SIMPLIFY_MODE_WHITELIST:
            keep_types = {t.strip() for t in args.simplify_types.split(",") if t.strip()}
            records = simplify_trajectory(records, keep_types)
            print(f"  Simplified to {len(records)} calls (whitelist, types: {', '.join(sorted(keep_types))})")
        else:
            records = simplify_trajectory_blacklist(records)
            print(f"  Simplified to {len(records)} calls (blacklist)")

    if args.fetch_call_details:
        records = await fetch_call_details(
            detail.project_id, start_date, records, batch_size=args.batch_size,
        )

    if args.show_errors:
        print("\nError report:")
        _print_error_report(records)

    jsonl_path = jsonl_dir / f"{safe_filename(meta.exercise_name)}.jsonl"
    write_jsonl(records, jsonl_path)
    print(f"  Saved {len(records)} calls -> {jsonl_path}")

    if args.visualize:
        vis_script = Path(__file__).parent / "visualize_trajectory.py"
        if vis_script.exists():
            html_dir.mkdir(parents=True, exist_ok=True)
            html_path = html_dir / f"{safe_filename(meta.exercise_name)}.html"
            proc = await asyncio.create_subprocess_exec(
                sys.executable,
                str(vis_script),
                str(jsonl_path),
                "--out",
                str(html_path),
                "--title",
                f"{meta.exercise_name} | {qsid} | trial-{args.trial_num}",
            )
            await proc.wait()
            print(f"  Visualization: {html_path}")

    print(f"\nDone. Output: {out_dir}/")
    return 0


# ---------------------------------------------------------------------------
# CLI argument parser
# ---------------------------------------------------------------------------


def main(argv: Sequence[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Fetch Arena trajectory data")
    p.add_argument(
        "--arena-evaluation-sid", required=True, help="Arena evaluation SID or URL"
    )
    p.add_argument(
        "--exercise-version-sid", default=None, help="Target exercise version SID"
    )
    p.add_argument("--question-sid", default=None, help="Sample question UUID")
    p.add_argument(
        "--trial-num", type=int, default=0, help="Instance trial number"
    )
    p.add_argument("--out-dir", default="./trajectory_export", help="Output directory")
    p.add_argument(
        "--visualize", action="store_true", help="Generate HTML visualization"
    )
    p.add_argument(
        "--batch-all",
        action="store_true",
        help="Batch download all exercises",
    )
    p.add_argument(
        "--cases-per-exercise",
        type=int,
        default=0,
        help="Random sample N cases per exercise (0 = all)",
    )
    p.add_argument(
        "--concurrency", type=int, default=10, help="Exercise-level batch concurrency"
    )
    p.add_argument(
        "--batch-size",
        type=int,
        default=LIST_CALLS_BATCH_SIZE,
        help=(
            "ListCalls chunk size — each chunk is one API request. "
            "Reduce to lower peak memory; increase to speed up fetching "
            f"(default: {LIST_CALLS_BATCH_SIZE})"
        ),
    )
    p.add_argument(
        "--model-name", default="", help="Model name override"
    )
    p.add_argument(
        "--fetch-call-details",
        action="store_true",
        help="Fetch detailed Content for each call via ListCalls",
    )
    p.add_argument(
        "--show-errors",
        action="store_true",
        help="Print diagnostic report of non-success nodes",
    )
    p.add_argument(
        "--simplify",
        action="store_true",
        help="Simplify trajectory by removing noise nodes",
    )
    p.add_argument(
        "--simplify-mode",
        default=SIMPLIFY_MODE_BLACKLIST,
        choices=[SIMPLIFY_MODE_BLACKLIST, SIMPLIFY_MODE_WHITELIST],
        help=(
            "Simplification strategy: 'blacklist' (default) removes known "
            "noise nodes; 'whitelist' keeps only --simplify-types"
        ),
    )
    p.add_argument(
        "--simplify-types",
        default=SIMPLIFY_DEFAULT_TYPES,
        help=(
            "Comma-separated node types to keep when --simplify-mode=whitelist "
            f"(default: {SIMPLIFY_DEFAULT_TYPES})"
        ),
    )
    args = p.parse_args(argv)
    return asyncio.run(_async_main(args))


if __name__ == "__main__":
    raise SystemExit(main())
