#!/usr/bin/env python3
import argparse
import csv
import io
import json
import math
import os
import re
import statistics
import sys
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple


_DEFAULT_X_CANDIDATES = (
    "step",
    "global_step",
    "train_step",
    "iteration",
    "iter",
    "epoch",
    "wall_time",
    "time",
    "timestamp",
)


_LOWER_BETTER_RE = re.compile(r"(loss|error|wer|cer|ppl|perplex|rmse|mae|mse|nll)", re.IGNORECASE)
_HIGHER_BETTER_RE = re.compile(r"(acc|accuracy|auc|f1|precision|recall|map|ndcg|bleu|rouge)", re.IGNORECASE)


@dataclass(frozen=True)
class Series:
    x: List[float]
    y: List[float]


@dataclass(frozen=True)
class RunData:
    name: str
    x_name: str
    metrics: Dict[str, Series]


def _is_url(s: str) -> bool:
    return s.startswith("http://") or s.startswith("https://")


def _read_text_from_source(source: str, encoding: str) -> str:
    if _is_url(source):
        req = urllib.request.Request(
            source,
            headers={
                "User-Agent": "metrics-csv-analyzer/1.0",
                "Accept": "text/csv,text/plain,*/*",
            },
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            return raw.decode("utf-8", errors="replace")

    with open(source, "r", encoding=encoding, newline="") as f:
        return f.read()


def _to_float(v: object) -> Optional[float]:
    if v is None:
        return None
    s = str(v).strip()
    if s == "" or s.lower() in {"nan", "none", "null"}:
        return None
    try:
        x = float(s)
    except ValueError:
        return None
    if math.isnan(x) or math.isinf(x):
        return None
    return x


def _normalize_header(name: str) -> str:
    return re.sub(r"\s+", "_", name.strip()).lower()


def _pick_x_column(fieldnames: Sequence[str], explicit_x: Optional[str]) -> Optional[str]:
    if explicit_x:
        return explicit_x

    normalized = { _normalize_header(f): f for f in fieldnames }
    for cand in _DEFAULT_X_CANDIDATES:
        if cand in normalized:
            return normalized[cand]
    return None


def _infer_metric_direction(metric_name: str) -> Optional[str]:
    if _LOWER_BETTER_RE.search(metric_name):
        return "lower"
    if _HIGHER_BETTER_RE.search(metric_name):
        return "higher"
    return None


def _moving_average(values: Sequence[float], window: int) -> List[float]:
    if window <= 1:
        return list(values)
    buf: List[float] = []
    out: List[float] = []
    running_sum = 0.0
    for v in values:
        buf.append(v)
        running_sum += v
        if len(buf) > window:
            running_sum -= buf.pop(0)
        out.append(running_sum / len(buf))
    return out


def _ema(values: Sequence[float], alpha: float) -> List[float]:
    if not values:
        return []
    if alpha <= 0.0 or alpha >= 1.0:
        return list(values)
    out: List[float] = []
    last = values[0]
    out.append(last)
    for v in values[1:]:
        last = alpha * v + (1.0 - alpha) * last
        out.append(last)
    return out


def _linear_regression_slope(xs: Sequence[float], ys: Sequence[float]) -> Optional[float]:
    if len(xs) < 3 or len(xs) != len(ys):
        return None
    mean_x = sum(xs) / len(xs)
    mean_y = sum(ys) / len(ys)
    num = 0.0
    den = 0.0
    for x, y in zip(xs, ys):
        dx = x - mean_x
        dy = y - mean_y
        num += dx * dy
        den += dx * dx
    if den == 0.0:
        return None
    return num / den


def _summarize_series(series: Series, direction: Optional[str], recent_window: int) -> Dict[str, object]:
    xs, ys = series.x, series.y
    if not xs or not ys:
        return {"points": 0}

    last = ys[-1]
    min_v = min(ys)
    max_v = max(ys)
    if direction == "lower":
        best = min_v
        best_name = "min"
    elif direction == "higher":
        best = max_v
        best_name = "max"
    else:
        best = None
        best_name = None

    k = min(recent_window, len(xs))
    recent_x = xs[-k:]
    recent_y = ys[-k:]
    slope = _linear_regression_slope(recent_x, recent_y)
    try:
        stdev = statistics.pstdev(recent_y) if len(recent_y) >= 2 else 0.0
        mean = sum(recent_y) / len(recent_y)
    except Exception:
        stdev = None
        mean = None

    return {
        "points": len(xs),
        "last": last,
        "min": min_v,
        "max": max_v,
        "best": best,
        "best_kind": best_name,
        "recent_window": k,
        "recent_slope": slope,
        "recent_mean": mean,
        "recent_stdev": stdev,
    }


def _load_run(source: str, x_name: Optional[str], metrics: Optional[Sequence[str]], delimiter: str, encoding: str, limit: Optional[int]) -> RunData:
    text = _read_text_from_source(source, encoding=encoding)
    buf = io.StringIO(text)
    reader = csv.DictReader(buf, delimiter=delimiter)
    if not reader.fieldnames:
        raise RuntimeError(f"CSV has no header: {source}")

    chosen_x = _pick_x_column(reader.fieldnames, x_name)
    x_values: List[float] = []
    y_values: Dict[str, List[float]] = {}

    wanted_metrics: Optional[set] = set(metrics) if metrics else None
    normalized_to_original = { _normalize_header(f): f for f in reader.fieldnames }

    if wanted_metrics:
        resolved = set()
        for m in wanted_metrics:
            if m in reader.fieldnames:
                resolved.add(m)
                continue
            nm = _normalize_header(m)
            if nm in normalized_to_original:
                resolved.add(normalized_to_original[nm])
        wanted_metrics = resolved

    def ensure_metric(name: str) -> None:
        if name not in y_values:
            y_values[name] = [float("nan")] * max(len(x_values) - 1, 0)

    row_count = 0
    for idx, row in enumerate(reader):
        if limit is not None and row_count >= limit:
            break
        row_count += 1

        if chosen_x and chosen_x in row:
            x = _to_float(row.get(chosen_x))
        else:
            x = float(idx)

        if x is None:
            continue

        if wanted_metrics is None:
            candidate_fields = [f for f in reader.fieldnames if f != chosen_x]
        else:
            candidate_fields = [f for f in reader.fieldnames if f in wanted_metrics and f != chosen_x]

        numeric_row: Dict[str, float] = {}
        for f in candidate_fields:
            y = _to_float(row.get(f))
            if y is None:
                continue
            numeric_row[f] = y

        if not numeric_row:
            continue

        x_values.append(x)
        for f, y in numeric_row.items():
            ensure_metric(f)
            y_values[f].append(y)

        for f in list(y_values.keys()):
            if f not in numeric_row:
                y_values[f].append(float("nan"))

    final_metrics: Dict[str, Series] = {}
    for m, ys in y_values.items():
        xs: List[float] = []
        cleaned: List[float] = []
        for x, y in zip(x_values, ys):
            if isinstance(y, float) and math.isnan(y):
                continue
            xs.append(x)
            cleaned.append(y)
        if len(cleaned) >= 2:
            final_metrics[m] = Series(x=xs, y=cleaned)

    run_name = Path(source).name if not _is_url(source) else re.sub(r"[^\w.-]+", "_", source)[-60:]
    return RunData(name=run_name, x_name=chosen_x or "index", metrics=final_metrics)


def _format_float(v: Optional[float]) -> str:
    if v is None:
        return "-"
    if abs(v) >= 1000 or (abs(v) > 0 and abs(v) < 1e-3):
        return f"{v:.6g}"
    return f"{v:.6f}".rstrip("0").rstrip(".")


def _safe_key(s: str) -> str:
    t = re.sub(r"[^\w.\-]+", "_", s.strip())
    return t[:160] if len(t) > 160 else t


def _read_last_x(state_dir: Path, run_key: str) -> Optional[float]:
    p = state_dir / f"{run_key}.json"
    if not p.exists():
        return None
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        v = data.get("last_x")
        if v is None:
            return None
        return float(v)
    except Exception:
        return None


def _write_last_x(state_dir: Path, run_key: str, last_x: float) -> None:
    state_dir.mkdir(parents=True, exist_ok=True)
    p = state_dir / f"{run_key}.json"
    payload = {"last_x": float(last_x), "updated_at": int(time.time())}
    p.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")


def _max_x(run: RunData) -> Optional[float]:
    xs: List[float] = []
    for s in run.metrics.values():
        xs.extend(s.x)
    return max(xs) if xs else None


def _filter_run_since_x(run: RunData, since_x: Optional[float]) -> Tuple[RunData, int]:
    if since_x is None:
        return run, 0
    new_metrics: Dict[str, Series] = {}
    new_points = 0
    for metric_name, series in run.metrics.items():
        xs: List[float] = []
        ys: List[float] = []
        for x, y in zip(series.x, series.y):
            if x > since_x:
                xs.append(x)
                ys.append(y)
        if len(xs) >= 2:
            new_metrics[metric_name] = Series(x=xs, y=ys)
            new_points = max(new_points, len(xs))
        elif len(xs) == 1:
            new_metrics[metric_name] = Series(x=xs, y=ys)
            new_points = max(new_points, 1)
    return RunData(name=run.name, x_name=run.x_name, metrics=new_metrics), new_points


def _print_text_summary(
    runs: Sequence[RunData],
    smooth: int,
    ema_alpha: Optional[float],
    recent_window: int,
    incremental_from_x: Optional[Dict[str, Optional[float]]] = None,
    new_points_by_run: Optional[Dict[str, int]] = None,
) -> None:
    for run in runs:
        print(f"RUN: {run.name}")
        print(f"X: {run.x_name}")
        if incremental_from_x is not None:
            last_x = incremental_from_x.get(run.name)
            print(f"INCREMENTAL_FROM_X: {_format_float(last_x) if last_x is not None else '-'}")
        if new_points_by_run is not None:
            print(f"NEW_POINTS: {int(new_points_by_run.get(run.name, 0))}")
        if not run.metrics:
            print("NO_METRICS")
            print("---")
            continue

        for metric_name in sorted(run.metrics.keys()):
            series = run.metrics[metric_name]
            direction = _infer_metric_direction(metric_name)

            ys = series.y
            if ema_alpha is not None:
                ys_s = _ema(ys, ema_alpha)
            else:
                ys_s = _moving_average(ys, smooth) if smooth > 1 else list(ys)

            summary = _summarize_series(Series(series.x, ys_s), direction=direction, recent_window=recent_window)
            best = summary.get("best")
            best_kind = summary.get("best_kind")
            slope = summary.get("recent_slope")
            stdev = summary.get("recent_stdev")
            mean = summary.get("recent_mean")

            parts = [
                f"METRIC: {metric_name}",
                f"points={summary.get('points', 0)}",
                f"last={_format_float(summary.get('last'))}",
                f"{best_kind}={_format_float(best) if best_kind else '-'}",
                f"recent_slope={_format_float(slope) if slope is not None else '-'}",
            ]
            if mean is not None and stdev is not None:
                parts.append(f"recent_mean±std={_format_float(mean)}±{_format_float(stdev)}")
            if direction:
                parts.append(f"direction={direction}")
            print("  " + " ".join(parts))
        print("---")


def _build_html_report(
    runs: Sequence[RunData],
    metrics: Optional[Sequence[str]],
    smooth: int,
    ema_alpha: Optional[float],
    title: str,
) -> str:
    run_payload: List[Dict[str, object]] = []
    metric_filter: Optional[set] = None
    if metrics:
        metric_filter = set()
        for m in metrics:
            metric_filter.add(m)
            metric_filter.add(_normalize_header(m))

    for run in runs:
        series_payload: Dict[str, Dict[str, List[float]]] = {}
        for metric_name, series in run.metrics.items():
            if metric_filter:
                if metric_name not in metric_filter and _normalize_header(metric_name) not in metric_filter:
                    continue
            ys = series.y
            if ema_alpha is not None:
                ys_s = _ema(ys, ema_alpha)
            else:
                ys_s = _moving_average(ys, smooth) if smooth > 1 else list(ys)
            series_payload[metric_name] = {
                "x": series.x,
                "y": ys,
                "y_s": ys_s,
            }
        run_payload.append({"name": run.name, "x_name": run.x_name, "series": series_payload})

    data_json = json.dumps(run_payload, ensure_ascii=False)
    title_escaped = title.replace("<", "&lt;").replace(">", "&gt;")

    return f"""<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title_escaped}</title>
  <script src="https://cdn.plot.ly/plotly-2.30.0.min.js"></script>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; margin: 16px; }}
    .meta {{ margin-bottom: 16px; }}
    .grid {{ display: grid; grid-template-columns: 1fr; gap: 18px; }}
    .chart {{ border: 1px solid #eee; border-radius: 8px; padding: 8px; }}
    .title {{ font-weight: 600; margin: 0 0 8px 0; }}
    .hint {{ color: #666; font-size: 12px; }}
  </style>
</head>
<body>
  <div class="meta">
    <div class="title">{title_escaped}</div>
    <div class="hint">raw + smoothed（smooth={smooth if smooth > 1 else 0}{", ema="+str(ema_alpha) if ema_alpha is not None else ""}）</div>
  </div>
  <div id="charts" class="grid"></div>
  <script>
    const runs = {data_json};
    const metricSet = new Set();
    for (const r of runs) {{
      for (const k of Object.keys(r.series)) metricSet.add(k);
    }}
    const metrics = Array.from(metricSet).sort();
    const chartsDiv = document.getElementById("charts");
    for (const metric of metrics) {{
      const container = document.createElement("div");
      container.className = "chart";
      const h = document.createElement("div");
      h.className = "title";
      h.textContent = metric;
      const plot = document.createElement("div");
      plot.style.width = "100%";
      plot.style.height = "420px";
      container.appendChild(h);
      container.appendChild(plot);
      chartsDiv.appendChild(container);

      const traces = [];
      for (const r of runs) {{
        const s = r.series[metric];
        if (!s) continue;
        traces.push({{
          x: s.x,
          y: s.y,
          mode: "lines",
          name: `${{r.name}} (raw)`,
          line: {{ width: 1 }},
          opacity: 0.35
        }});
        traces.push({{
          x: s.x,
          y: s.y_s,
          mode: "lines",
          name: `${{r.name}} (smoothed)`,
          line: {{ width: 2 }},
        }});
      }}

      const layout = {{
        margin: {{ l: 56, r: 24, t: 8, b: 48 }},
        legend: {{ orientation: "h" }},
        xaxis: {{ title: runs[0] ? runs[0].x_name : "x" }},
        yaxis: {{ title: metric }},
      }};
      Plotly.newPlot(plot, traces, layout, {{responsive: true}});
    }}
  </script>
</body>
</html>
"""


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Analyze Merlin metrics CSV and plot curves (no extra deps).")
    parser.add_argument("inputs", nargs="+", help="CSV file path(s) or URL(s)")
    parser.add_argument("--x", dest="x_name", default=None, help="x-axis column name (default: auto-detect)")
    parser.add_argument("--metrics", nargs="*", default=None, help="metric column names to analyze/plot (default: auto)")
    parser.add_argument("--delimiter", default=",", help="CSV delimiter (default: ,)")
    parser.add_argument("--encoding", default="utf-8", help="file encoding (default: utf-8)")
    parser.add_argument("--limit", type=int, default=None, help="max rows to read per CSV")

    smooth_group = parser.add_mutually_exclusive_group()
    smooth_group.add_argument("--smooth", type=int, default=0, help="moving average window (default: 0)")
    smooth_group.add_argument("--ema", type=float, default=None, help="EMA alpha in (0,1)")

    parser.add_argument("--recent-window", type=int, default=20, help="recent window for trend stats (default: 20)")
    parser.add_argument("--state-dir", default=None, help="state directory for incremental monitoring (optional)")
    parser.add_argument("--full", action="store_true", help="disable incremental mode and analyze full CSV")
    parser.add_argument("--out", default=None, help="output HTML path (optional)")
    parser.add_argument("--title", default="Metrics Curves Report", help="HTML report title")
    parser.add_argument("--json", dest="json_out", default=None, help="output JSON summary path (optional)")

    args = parser.parse_args(argv)

    runs: List[RunData] = []
    for src in args.inputs:
        runs.append(
            _load_run(
                src,
                x_name=args.x_name,
                metrics=args.metrics,
                delimiter=args.delimiter,
                encoding=args.encoding,
                limit=args.limit,
            )
        )

    state_dir = Path(args.state_dir).expanduser().resolve() if args.state_dir else None
    incremental_from_x: Optional[Dict[str, Optional[float]]] = None
    new_points_by_run: Optional[Dict[str, int]] = None
    runs_for_output = runs
    if state_dir is not None and not args.full:
        incremental_from_x = {}
        new_points_by_run = {}
        filtered: List[RunData] = []
        for run in runs:
            run_key = _safe_key(run.name)
            last_x = _read_last_x(state_dir, run_key)
            incremental_from_x[run.name] = last_x
            frun, new_pts = _filter_run_since_x(run, since_x=last_x)
            new_points_by_run[run.name] = new_pts
            filtered.append(frun)
        runs_for_output = filtered

    _print_text_summary(
        runs_for_output,
        smooth=max(args.smooth, 0),
        ema_alpha=args.ema,
        recent_window=max(args.recent_window, 3),
        incremental_from_x=incremental_from_x,
        new_points_by_run=new_points_by_run,
    )

    if args.json_out:
        payload = []
        for run in runs_for_output:
            metrics_payload = {}
            for metric_name, series in run.metrics.items():
                direction = _infer_metric_direction(metric_name)
                ys = series.y
                ys_s = _ema(ys, args.ema) if args.ema is not None else (_moving_average(ys, args.smooth) if args.smooth > 1 else list(ys))
                metrics_payload[metric_name] = _summarize_series(Series(series.x, ys_s), direction=direction, recent_window=max(args.recent_window, 3))
            payload.append({"run": run.name, "x": run.x_name, "metrics": metrics_payload})
        out_path = Path(args.json_out)
        out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.out:
        html = _build_html_report(
            runs=runs_for_output,
            metrics=args.metrics,
            smooth=max(args.smooth, 0),
            ema_alpha=args.ema,
            title=args.title,
        )
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(html, encoding="utf-8")
        print(f"HTML_REPORT: {os.path.abspath(str(out_path))}")

    if state_dir is not None and not args.full:
        for run in runs:
            run_key = _safe_key(run.name)
            mx = _max_x(run)
            if mx is not None:
                _write_last_x(state_dir, run_key, mx)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
