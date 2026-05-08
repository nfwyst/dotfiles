#!/usr/bin/env python3
import argparse
import csv
import json
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple
from urllib.parse import parse_qs, urlparse

MAX_RETRIES = 3
RETRY_BACKOFF_BASE = 2.0


@dataclass(frozen=True)
class ExerciseRow:
    exercise_key: str
    exercise_sid: str
    exercise_version_sid: str
    completed: int
    avg_score: Optional[float]
    error_rate: Optional[float]
    raw_score: Dict[str, Any]


def _run_merlin_cli(args: Sequence[str], retries: int = 0) -> Dict[str, Any]:
    cmd = ["merlin-cli", *args]
    last_err: Optional[Exception] = None
    for attempt in range(1 + retries):
        if attempt > 0:
            wait = RETRY_BACKOFF_BASE ** attempt
            print(f"[retry {attempt}/{retries}] waiting {wait:.0f}s before retrying …", file=sys.stderr)
            time.sleep(wait)
        try:
            p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if p.returncode != 0:
                raise RuntimeError(f"merlin-cli failed: {' '.join(cmd)}\n{p.stderr.strip()}")
            out = p.stdout.strip()
            if not out:
                raise RuntimeError(f"merlin-cli returned empty output: {' '.join(cmd)}")
            return json.loads(out)
        except Exception as e:
            last_err = e
            stderr_snippet = getattr(e, '__str__', lambda: '')()
            if "502" in stderr_snippet or "Bad Gateway" in stderr_snippet or "upstream" in stderr_snippet:
                continue
            if attempt < retries:
                continue
            raise
    raise last_err  # type: ignore[misc]


def _extract_evaluation_task_sid(url_or_sid: str) -> str:
    s = url_or_sid.strip()
    if not s:
        raise RuntimeError("empty url/sid")
    if re.fullmatch(r"[a-z0-9]{10,64}", s):
        return s
    u = urlparse(s)
    qs = parse_qs(u.query or "")
    sid = (qs.get("evaluation_task_sid") or [""])[0].strip()
    if not sid:
        raise RuntimeError("cannot find evaluation_task_sid in URL query")
    return sid


def _safe_filename(s: str) -> str:
    x = re.sub(r"[^\w.\-]+", "_", s.strip())
    return x[:180] if len(x) > 180 else x


def _get_nested(d: Dict[str, Any], path: Sequence[str]) -> Any:
    cur: Any = d
    for k in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(k)
    return cur


def _as_float(x: Any) -> Optional[float]:
    if x is None:
        return None
    if isinstance(x, (int, float)):
        return float(x)
    try:
        return float(str(x))
    except Exception:
        return None


def _as_int(x: Any) -> int:
    if x is None:
        return 0
    if isinstance(x, bool):
        return int(x)
    if isinstance(x, int):
        return x
    if isinstance(x, float):
        return int(x)
    try:
        return int(str(x))
    except Exception:
        return 0


def _extract_exercises(arena_eval: Dict[str, Any]) -> List[ExerciseRow]:
    detail = _get_nested(arena_eval, ["arena_evaluation", "progress", "detail"]) \
        or _get_nested(arena_eval, ["evaluation", "progress", "detail"])
    if not isinstance(detail, dict) or not detail:
        raise RuntimeError("missing arena_evaluation.progress.detail in get_arena_evaluation output")

    rows: List[ExerciseRow] = []
    for exercise_key, v in detail.items():
        if not isinstance(v, dict):
            continue
        exercise_sid = str(v.get("exercise_sid") or "")
        exercise_version_sid = str(v.get("exercise_version_sid") or "")
        if not exercise_sid or not exercise_version_sid:
            continue
        score = v.get("score") if isinstance(v.get("score"), dict) else {}
        avg_score = _as_float(score.get("avg_score")) if isinstance(score, dict) else None
        error_rate = _as_float(score.get("error_rate")) if isinstance(score, dict) else None
        completed = _as_int(v.get("completed"))
        rows.append(
            ExerciseRow(
                exercise_key=str(exercise_key),
                exercise_sid=exercise_sid,
                exercise_version_sid=exercise_version_sid,
                completed=completed,
                avg_score=avg_score,
                error_rate=error_rate,
                raw_score=score if isinstance(score, dict) else {},
            )
        )
    rows.sort(key=lambda r: (-(r.avg_score or -1e18), r.exercise_key))
    return rows


def _write_exercises_csv(rows: List[ExerciseRow], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    score_keys: List[str] = []
    for r in rows:
        if isinstance(r.raw_score, dict):
            for k in r.raw_score.keys():
                if k not in score_keys:
                    score_keys.append(k)
    preferred = ["avg_score", "error_rate", "bon", "pass@k=1"]
    score_keys = [k for k in preferred if k in score_keys] + [k for k in score_keys if k not in preferred]
    fieldnames = [
        "exercise_key",
        "exercise_sid",
        "exercise_version_sid",
        "completed",
        "avg_score",
        "error_rate",
        *[f"score.{k}" for k in score_keys],
    ]
    with out_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            row: Dict[str, Any] = {
                "exercise_key": r.exercise_key,
                "exercise_sid": r.exercise_sid,
                "exercise_version_sid": r.exercise_version_sid,
                "completed": r.completed,
                "avg_score": r.avg_score,
                "error_rate": r.error_rate,
            }
            for k in score_keys:
                row[f"score.{k}"] = r.raw_score.get(k)
            w.writerow(row)


def _iter_selected_exercises(
    rows: List[ExerciseRow],
    exercise_version_sid: Optional[str],
    max_exercises_for_cases: int,
) -> List[ExerciseRow]:
    if exercise_version_sid:
        s = exercise_version_sid.strip()
        chosen = [r for r in rows if r.exercise_version_sid == s]
        if not chosen:
            raise RuntimeError(f"exercise_version_sid not found in evaluation: {s}")
        return chosen
    if max_exercises_for_cases == 0:
        return list(rows)
    return list(rows[: max(max_exercises_for_cases, 0)])


def _parse_case_payload(payload: Any) -> Dict[str, Any]:
    if not isinstance(payload, str) or not payload.strip():
        return {}
    try:
        return json.loads(payload)
    except Exception:
        return {}


def _extract_case_brief(case_item: Dict[str, Any]) -> Dict[str, Any]:
    payload_obj = _parse_case_payload(case_item.get("payload"))
    score = payload_obj.get("score")
    prompt = payload_obj.get("prompt")
    predict = payload_obj.get("predict0") or payload_obj.get("predict_0") or payload_obj.get("predict")
    answer = payload_obj.get("answer")
    traj = payload_obj.get("__trajectory_url___0") or payload_obj.get("trajectory_url") or payload_obj.get("__trajectory_url__")
    question_id = case_item.get("question_id") or payload_obj.get("question_id") or payload_obj.get("__internal_uuid__")
    return {
        "question_id": question_id,
        "exercise_version_sid": case_item.get("exercise_version_sid"),
        "timestamp": case_item.get("timestamp"),
        "score": score,
        "prompt": prompt,
        "predict": predict,
        "answer": answer,
        "trajectory_url": traj,
        "payload_keys": sorted(list(payload_obj.keys())) if isinstance(payload_obj, dict) else [],
    }


def _fetch_cases_for_exercise(
    evaluation_instance_sid: str,
    exercise: ExerciseRow,
    out_dir: Path,
    cases_per_exercise: int,
    page_size: int,
) -> Tuple[int, Path]:
    cases_dir = out_dir / "cases"
    cases_dir.mkdir(parents=True, exist_ok=True)
    out_path = cases_dir / f"{_safe_filename(exercise.exercise_version_sid)}.jsonl"

    want = max(cases_per_exercise, 0)
    if want == 0:
        want = 10**18

    offset = 0
    wrote = 0
    page = 0
    target_label = exercise.exercise_key or exercise.exercise_version_sid
    with out_path.open("w", encoding="utf-8") as f:
        while wrote < want:
            page += 1
            limit = min(page_size, want - wrote)
            print(
                f"\r  {target_label}: fetching page {page} (offset={offset}, {wrote} cases so far) …",
                end="", flush=True, file=sys.stderr,
            )
            resp = _run_merlin_cli(
                [
                    "arena",
                    "list-case",
                    "--json",
                    json.dumps(
                        {
                            "evaluation_instance_sid": evaluation_instance_sid,
                            "exercise_version_sid": exercise.exercise_version_sid,
                            "limit": int(limit),
                            "offset": int(offset),
                        }
                    ),
                ],
                retries=MAX_RETRIES,
            )
            items = resp.get("case")
            if not isinstance(items, list) or not items:
                break
            for item in items:
                if not isinstance(item, dict):
                    continue
                brief = _extract_case_brief(item)
                f.write(json.dumps(brief, ensure_ascii=False) + "\n")
                wrote += 1
                if wrote >= want:
                    break
            offset += len(items)
            if len(items) < limit:
                break
    print(f"\r  {target_label}: done — {wrote} cases saved{' ' * 40}", file=sys.stderr)
    return wrote, out_path


def _write_report(
    out_dir: Path,
    evaluation_instance_sid: str,
    arena_eval: Dict[str, Any],
    exercises: List[ExerciseRow],
    case_stats: List[Tuple[ExerciseRow, int, Optional[Path]]],
) -> Path:
    out_path = out_dir / "report.md"
    ev = arena_eval.get("arena_evaluation") or arena_eval.get("evaluation") or {}
    if not isinstance(ev, dict):
        ev = {}
    title = str(ev.get("name") or "Arena Evaluation")
    arena_sid = str(ev.get("arena_sid") or "")
    status = str(ev.get("status") or "")
    created_at = str(ev.get("created_at") or "")
    completed_at = str(ev.get("completed_at") or "")
    evaluation_url = str(ev.get("evaluation_url") or "")

    lines: List[str] = []
    lines.append(f"# {title}")
    lines.append("")
    lines.append("## 任务信息")
    lines.append("")
    lines.append(f"- evaluation_instance_sid: {evaluation_instance_sid}")
    if arena_sid:
        lines.append(f"- arena_sid: {arena_sid}")
    if status:
        lines.append(f"- status: {status}")
    if created_at:
        lines.append(f"- created_at: {created_at}")
    if completed_at:
        lines.append(f"- completed_at: {completed_at}")
    if evaluation_url:
        lines.append(f"- evaluation_url: {evaluation_url}")
    lines.append("")
    lines.append("## Exercises（按 avg_score 降序）")
    lines.append("")
    lines.append("| # | exercise_key | exercise_version_sid | completed | avg_score | error_rate |")
    lines.append("|---:|---|---|---:|---:|---:|")
    for i, r in enumerate(exercises, 1):
        avg_score_cell = "" if r.avg_score is None else f"{r.avg_score:.6g}"
        error_rate_cell = "" if r.error_rate is None else f"{r.error_rate:.6g}"
        lines.append(
            f"| {i} | {r.exercise_key} | {r.exercise_version_sid} | {r.completed} | {avg_score_cell} | {error_rate_cell} |"
        )
    lines.append("")

    if case_stats:
        lines.append("## Case 拉取统计")
        lines.append("")
        lines.append("| exercise_version_sid | avg_score | cases_saved | file |")
        lines.append("|---|---:|---:|---|")
        for ex, n, p in case_stats:
            file_cell = str(p.relative_to(out_dir)) if p else ""
            avg_score_cell = "" if ex.avg_score is None else f"{ex.avg_score:.6g}"
            lines.append(f"| {ex.exercise_version_sid} | {avg_score_cell} | {n} | {file_cell} |")
        lines.append("")

    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return out_path


def main(argv: Optional[Sequence[str]] = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--url", required=True, help="Arena evaluation url or evaluation_task_sid")
    p.add_argument("--out-dir", default="./arena_eval_export", help="output directory")
    p.add_argument("--fetch-cases", action="store_true", help="also fetch cases per exercise")
    p.add_argument("--exercise-version-sid", default=None, help="only fetch cases for this exercise_version_sid")
    p.add_argument("--max-exercises-for-cases", type=int, default=10, help="limit exercises when fetching cases (0 = no limit)")
    p.add_argument("--cases-per-exercise", type=int, default=50, help="max cases per exercise (0 = no limit)")
    p.add_argument("--page-size", type=int, default=100, help="page size for arena list-case")
    args = p.parse_args(argv)

    evaluation_instance_sid = _extract_evaluation_task_sid(args.url)
    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    arena_eval = _run_merlin_cli(
        ["arena", "get-evaluation", "--json", json.dumps({"sid": evaluation_instance_sid})]
    )
    raw_path = out_dir / "arena_evaluation.raw.json"
    raw_path.write_text(json.dumps(arena_eval, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    exercises = _extract_exercises(arena_eval)
    exercises_csv = out_dir / "exercises.csv"
    _write_exercises_csv(exercises, exercises_csv)

    case_stats: List[Tuple[ExerciseRow, int, Optional[Path]]] = []
    if args.fetch_cases:
        chosen = _iter_selected_exercises(
            exercises,
            exercise_version_sid=args.exercise_version_sid,
            max_exercises_for_cases=int(args.max_exercises_for_cases),
        )
        total = len(chosen)
        print(f"Fetching cases for {total} exercise(s) …", file=sys.stderr)
        for i, ex in enumerate(chosen, 1):
            print(f"[{i}/{total}] {ex.exercise_key or ex.exercise_version_sid}", file=sys.stderr)
            try:
                n, path = _fetch_cases_for_exercise(
                    evaluation_instance_sid=evaluation_instance_sid,
                    exercise=ex,
                    out_dir=out_dir,
                    cases_per_exercise=int(args.cases_per_exercise),
                    page_size=int(args.page_size),
                )
                case_stats.append((ex, n, path))
            except Exception as e:
                print(f"  FAILED: {e}", file=sys.stderr)
                case_stats.append((ex, 0, None))

    report_path = _write_report(
        out_dir=out_dir,
        evaluation_instance_sid=evaluation_instance_sid,
        arena_eval=arena_eval,
        exercises=exercises,
        case_stats=case_stats,
    )

    print(json.dumps({"out_dir": str(out_dir), "report": str(report_path), "exercises_csv": str(exercises_csv), "raw_json": str(raw_path)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
