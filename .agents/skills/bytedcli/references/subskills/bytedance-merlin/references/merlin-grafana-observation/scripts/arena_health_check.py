#!/usr/bin/env python3
"""Arena / Job 任务健康检查：查询指标 + 异常检测 + 报告生成。

从 Arena URL、evaluation_task_sid 或 trial_id 出发，自动采集 Evals 业务指标和 Arnold 容器资源指标，
检测异常并生成 Markdown 或 HTML 报告。

用法:
    # Arena 模式：传入 evaluation_task_sid
    python arena_health_check.py --eval-sid g9x1y4uut169d0a0d6

    # Arena 模式：从 Arena URL 解析
    python arena_health_check.py --arena-url "https://seed.bytedance.net/evaluation/arena/xxx?evaluation_task_sid=yyy"

    # Job 模式：直接传 trial_id（跳过 Arena 信息获取，仅查 Arnold 资源指标）
    python arena_health_check.py --trial-id 339612520

    # 输出 HTML
    python arena_health_check.py --eval-sid g9x1y4uut169d0a0d6 --format html --output report.html
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import parse_qs, urlparse

# ── 常量 ──────────────────────────────────────────────────────────────────────

OPENAPI_BASE = "https://cloud.bytedance.net/api/v1/grafana_open_api"

# Evals 看板
EVALS_UID = "ejyXFpTHk"
EVALS_BASE = f"https://grafana.byted.org/d/{EVALS_UID}/zheng-shi-evalsyong-hu-ren-wu-jian-kong-zhong-gou-ban"

# Arnold Role 看板（首选，GPU 全量指标）
ARNOLD_ROLE_UID = "JiidrBwGzrole"
ARNOLD_ROLE_BASE = f"https://grafana.byted.org/d/{ARNOLD_ROLE_UID}/arnold-shi-li-jian-kong-kan-ban-roleji-bie"

# Arnold Container 看板（TCE 容器级，mem_limit 权威来源）
ARNOLD_CONTAINER_UID = "LgKuxDjSz"
ARNOLD_CONTAINER_BASE = f"https://grafana.byted.org/d/{ARNOLD_CONTAINER_UID}/arnold-docker-container-metrics"

# 需要查询的 Evals Panel（id → 描述）
EVALS_PANELS = {
    138: "evaluate 完成度",
    136: "各阶段耗时 P99",
    184: "chat_completion QPM",
    183: "chat_completion P99 耗时",
    146: "mem_rss",
    120: "batch_size",
    186: "未完成 instance 数量",
    191: "instance 最大推理轮数",
}

# Arnold Role 看板 Panel（id → 描述）
ARNOLD_PANELS = {
    2: "CPU Cores",
    40: "CPU Throttle",
    3: "Memory",
    4: "Disk Usage",
    5: "Network",
    7: "GPU DutyCycle",
    6: "GPU Memory",
}

# Arnold Container 看板 Panel（OOM 判定用 unreclaimable_ratio）
CONTAINER_OOM_PANELS = {
    91: "不可回收内存比率 (unreclaimable_ratio)",
}


# ── 数据模型 ────────────────────────────────────────────────────────────────────


@dataclass
class Anomaly:
    """单条异常记录。"""

    category: str  # "evals" | "resource"
    metric: str
    severity: str  # "critical" | "warning" | "info"
    message: str
    value: str
    threshold: str


@dataclass
class MetricSummary:
    """单个指标的统计摘要。"""

    name: str
    panel_id: int
    avg: Optional[float] = None
    max: Optional[float] = None
    min: Optional[float] = None
    last: Optional[float] = None
    unit: str = ""
    tags: dict = field(default_factory=dict)
    raw_series: list = field(default_factory=list)


@dataclass
class HealthReport:
    """完整的健康检查报告。"""

    eval_sid: str
    arena_sid: str = ""
    status: str = ""
    creator: str = ""
    created_at: str = ""
    completed_at: str = ""
    arnold_trial_id: str = ""
    cluster: str = ""
    dc: str = ""
    resource_config: dict = field(default_factory=dict)
    evals_metrics: list[MetricSummary] = field(default_factory=list)
    arnold_metrics: dict[str, list[MetricSummary]] = field(default_factory=dict)  # role → metrics
    anomalies: list[Anomaly] = field(default_factory=list)
    grafana_urls: dict = field(default_factory=dict)


# ── 认证 ───────────────────────────────────────────────────────────────────────


def load_jwt() -> str:
    """通过 merlin-cli 获取 JWT token（与其他 skill 保持一致，不直接读取 auth 文件）。"""
    try:
        result = subprocess.run(
            ["merlin-cli", "--control-plane", "cn-seed", "login", "get-jwt"],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode != 0:
            print(
                "错误：获取 JWT 失败\n请执行: merlin-cli login --control-plane cn-seed --oauth2 --force",
                file=sys.stderr,
            )
            sys.exit(1)
        stdout = result.stdout.strip()
        if not stdout:
            print("错误：JWT 为空，请重新登录", file=sys.stderr)
            sys.exit(1)
        # merlin-cli get-jwt 返回 JSON: {"jwt_token": "...", "success": true}
        try:
            data = json.loads(stdout)
            token = data.get("jwt_token", "")
        except json.JSONDecodeError:
            token = stdout
        if not token:
            print("错误：JWT 为空，请重新登录", file=sys.stderr)
            sys.exit(1)
        return token
    except FileNotFoundError:
        print("错误：找不到 merlin-cli，请先安装", file=sys.stderr)
        sys.exit(1)


# ── API 调用 ──────────────────────────────────────────────────────────────────────


def grafana_post(endpoint: str, body: dict, jwt: str) -> dict:
    """调用 Grafana OpenAPI。"""
    url = f"{OPENAPI_BASE}/{endpoint}"
    payload = json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "X-JWT-Token": jwt},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode(errors="replace")[:300]
        if e.code == 401:
            print("JWT 过期，请执行: merlin-cli login --control-plane cn-seed --oauth2 --force", file=sys.stderr)
        else:
            print(f"Grafana API HTTP {e.code}: {body_text}", file=sys.stderr)
        return {"error": f"HTTP {e.code}", "detail": body_text}


def merlin_cli(args: list[str], timeout: int = 30) -> dict:
    """调用 merlin-cli 并返回 JSON 结果。

    merlin-cli 默认输出 JSON 到 stdout（部分子命令不支持 --output 参数）。
    stderr 可能包含登录刷新等信息，忽略即可。
    正常调用 1-2 秒内返回，默认 30 秒超时足够覆盖 JWT 刷新场景。
    """
    cmd = ["merlin-cli", "--control-plane", "cn-seed"] + args
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        if result.returncode != 0:
            print(f"merlin-cli 失败: {result.stderr[:300]}", file=sys.stderr)
            return {}
        # stdout 可能夹杂非 JSON 行（如 JWT renewed），提取最外层 JSON 对象
        stdout = result.stdout.strip()
        if not stdout:
            return {}
        # 找到第一个 '{' 开始解析，跳过可能的前置日志行
        json_start = stdout.find("{")
        if json_start == -1:
            return {}
        return json.loads(stdout[json_start:])
    except subprocess.TimeoutExpired:
        print(f"merlin-cli 超时 ({timeout}s): {' '.join(cmd[:5])}...", file=sys.stderr)
        return {}
    except (json.JSONDecodeError, FileNotFoundError) as e:
        print(f"merlin-cli 调用异常: {e}", file=sys.stderr)
        return {}


# ── 数据采集 ────────────────────────────────────────────────────────────────────


def get_arena_info(eval_sid: str) -> dict:
    """通过 merlin-cli 获取 Arena 评估任务信息。"""
    return merlin_cli(["arena", "get-evaluation", "--sid", eval_sid])


def get_grafana_url(trial_id: str) -> dict:
    """通过 merlin-cli 获取 Grafana URL（含 cluster/dc）。"""
    return merlin_cli(["job", "get-grafana", "--trial_id", trial_id])


# 并行查询线程数：平衡速度与 API 压力
_MAX_WORKERS = 8
_print_lock = threading.Lock()


def job_psm_var() -> str:
    """Return the Grafana job_psm variable supplied by the caller."""
    return os.environ.get("MERLIN_GRAFANA_JOB_PSM", "example.merlin.job")


def query_panel(jwt: str, dashboard_url: str, panel_id: int) -> list:
    """查询单个 Panel 的时序数据，返回 total 列表。"""
    url_with_panel = f"{dashboard_url}&viewPanel={panel_id}"
    t0 = time.time()
    result = grafana_post("screenshot", {"url": url_with_panel, "only_data": True}, jwt)
    elapsed = time.time() - t0
    if "error" in result:
        with _print_lock:
            print(f"         → panel {panel_id} error ({elapsed:.1f}s)", file=sys.stderr)
        return []
    total = result.get("total", [])
    with _print_lock:
        print(f"         → panel {panel_id}: {len(total)} series ({elapsed:.1f}s)", file=sys.stderr)
    return total


def _query_and_parse(jwt: str, url: str, panel_id: int, desc: str) -> list[MetricSummary]:
    """查询单个面板并解析为 MetricSummary（供线程池调用）。"""
    total = query_panel(jwt, url, panel_id)
    stats = extract_series_stats(total)
    for s in stats:
        s.panel_id = panel_id
        s.unit = desc
    return stats


def extract_series_stats(total: list) -> list[MetricSummary]:
    """从 Panel 返回的 total 中提取统计摘要。"""
    summaries = []
    for item in total:
        # 解析 metric 名称
        metric_name = ""
        payload = item.get("payload", "")
        if payload:
            try:
                p = json.loads(payload) if isinstance(payload, str) else payload
                qs = p.get("queries", [])
                if qs:
                    metric_name = qs[0].get("metric", "")
            except (json.JSONDecodeError, TypeError):
                pass

        data_list = item.get("data", [])
        if not isinstance(data_list, list):
            continue

        for series in data_list:
            if not isinstance(series, dict):
                continue
            dps = series.get("dps", {})
            vals = list(dps.values())
            if not vals:
                continue

            tags = series.get("tags", {})
            summaries.append(
                MetricSummary(
                    name=metric_name or series.get("metric", "unknown"),
                    panel_id=0,
                    avg=sum(vals) / len(vals),
                    max=max(vals),
                    min=min(vals),
                    last=vals[-1] if vals else None,
                    tags=tags,
                    raw_series=vals,
                )
            )
    return summaries


def collect_evals_metrics(
    jwt: str, eval_sid: str, arena_sid: str, trial_id: str, from_ms: int, to_ms: int
) -> list[MetricSummary]:
    """采集 Evals 业务指标（并行查询所有面板）。"""
    evals_url = (
        f"{EVALS_BASE}?orgId=1"
        f"&var-arena_instance_id={eval_sid}"
        f"&var-arnold_trial_id={trial_id}"
        f"&var-exercise_version_sid=*&var-iteration_stage=*"
        f"&from={from_ms}&to={to_ms}"
    )
    all_metrics: list[MetricSummary] = []
    with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as pool:
        futures = {
            pool.submit(_query_and_parse, jwt, evals_url, pid, desc): pid
            for pid, desc in EVALS_PANELS.items()
        }
        for future in as_completed(futures):
            all_metrics.extend(future.result())
    return all_metrics


def collect_arnold_metrics(
    jwt: str, trial_id: str, role: str, cluster: str, dc: str, from_ms: int, to_ms: int
) -> list[MetricSummary]:
    """采集 Arnold Role 级别容器资源指标（并行查询所有面板）。"""
    arnold_url = (
        f"{ARNOLD_ROLE_BASE}?orgId=1"
        f"&var-cluster={cluster}&var-job_psm={job_psm_var()}"
        f"&var-target_arnold_trial_id={trial_id}"
        f"&var-target_arnold_role={role}"
        f"&var-dc={dc}&var-task_family=arnold"
        f"&var-metricsBytedIsGroupByRegion__=true"
        f"&var-metricsBytedVRegion__=China-North"
        f"&var-hostnum=All&var-eth_name=All"
        f"&var-hdfs_task_family=arnold"
        f"&var-hdfs_tenant=default&var-hdfs_datasource=bytetsd"
        f"&from={from_ms}&to={to_ms}"
    )
    all_metrics: list[MetricSummary] = []
    with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as pool:
        futures = {
            pool.submit(_query_and_parse, jwt, arnold_url, pid, desc): pid
            for pid, desc in ARNOLD_PANELS.items()
        }
        for future in as_completed(futures):
            all_metrics.extend(future.result())
    return all_metrics


# ── 异常检测 ────────────────────────────────────────────────────────────────────


def detect_anomalies(report: HealthReport) -> list[Anomaly]:
    """根据采集到的指标检测异常。"""
    anomalies = []

    # ── Evals 业务异常 ──
    for m in report.evals_metrics:
        # 完成度为 0
        if m.panel_id == 138 and "finished" in str(m.tags.get("status", "")):
            if m.last is not None and m.last == 0:
                anomalies.append(
                    Anomaly(
                        "evals",
                        "完成度",
                        "critical",
                        "任务完成数量为 0，未完成任何 exercise",
                        f"finished={m.last}",
                        "finished > 0",
                    )
                )

        # P99 推理耗时 > 60s
        if m.panel_id == 183 and m.avg is not None and m.avg > 60:
            anomalies.append(
                Anomaly(
                    "evals",
                    "推理 P99 耗时",
                    "warning" if m.avg < 300 else "critical",
                    f"chat_completion P99 耗时 avg={m.avg:.1f}s，推理延迟{'严重' if m.avg > 300 else '偏高'}",
                    f"avg={m.avg:.1f}s max={m.max:.1f}s" if m.max else f"avg={m.avg:.1f}s",
                    "<60s",
                )
            )

        # batch_size = 1（可能未启用 batching）
        if m.panel_id == 120 and m.avg is not None and m.avg <= 1.0:
            anomalies.append(
                Anomaly(
                    "evals",
                    "batch_size",
                    "info",
                    f"batch_size={m.avg:.1f}，未启用 batching，影响推理吞吐",
                    f"avg={m.avg:.1f}",
                    ">1",
                )
            )

        # 最大推理轮数过高（Agent/Trajectory 可能死循环）
        if m.panel_id == 191 and m.max is not None and m.max > 50:
            anomalies.append(
                Anomaly(
                    "evals",
                    "最大推理轮数",
                    "warning",
                    f"最大推理轮数={m.max:.0f}，Agent 可能存在循环",
                    f"max={m.max:.0f}",
                    "<=50",
                )
            )

        # 未完成 instance 数量持续增长
        if m.panel_id == 186 and m.max is not None and m.max > 500:
            anomalies.append(
                Anomaly(
                    "evals",
                    "未完成 instance",
                    "warning",
                    f"未完成 instance 最高达 {m.max:.0f}，大量 instance 堆积",
                    f"max={m.max:.0f}",
                    "<=500",
                )
            )

        # mem_rss 过高（>30GB）
        if m.panel_id == 146 and m.max is not None and m.max > 30 * 1024:
            anomalies.append(
                Anomaly(
                    "evals",
                    "进程 mem_rss",
                    "warning",
                    f"进程 RSS 内存 max={m.max / 1024:.1f}GB，内存占用偏高",
                    f"max={m.max / 1024:.1f}GB",
                    "<30GB",
                )
            )

    # ── Arnold 容器资源异常 ──
    for role, metrics in report.arnold_metrics.items():
        mem_rss_max = None
        mem_usage_max = None
        mem_cache_max = None
        mem_limit_max = None

        for m in metrics:
            if m.panel_id == 91:
                continue
            if "mem_rss" in m.name and m.max is not None:
                mem_rss_max = max(mem_rss_max or 0, m.max)
            if "mem_usage" in m.name and m.max is not None:
                mem_usage_max = max(mem_usage_max or 0, m.max)
            if "mem_cache" in m.name and m.max is not None:
                mem_cache_max = max(mem_cache_max or 0, m.max)
            if "mem_limit" in m.name and m.max is not None:
                mem_limit_max = max(mem_limit_max or 0, m.max)

            # CPU 利用率接近 limit
            if m.panel_id == 2 and m.max is not None and m.max > 90:
                anomalies.append(
                    Anomaly(
                        "resource",
                        f"{role} CPU",
                        "critical",
                        f"{role} CPU 使用率 max={m.max:.1f}%，接近打满",
                        f"avg={m.avg:.1f}% max={m.max:.1f}%",
                        "<90%",
                    )
                )

            # CPU Throttle
            if m.panel_id == 40 and m.max is not None and m.max > 0:
                anomalies.append(
                    Anomaly(
                        "resource",
                        f"{role} CPU Throttle",
                        "warning",
                        f"{role} CPU 存在限流 (throttle max={m.max:.2f})",
                        f"max={m.max:.2f}",
                        "=0",
                    )
                )

        # GPU 利用率：按 role 整体判断（取所有 pod 的平均值），避免逐台误报
        gpu_duty_vals = [m.avg for m in metrics if m.panel_id == 7 and m.avg is not None]
        if gpu_duty_vals and role == "worker":
            overall_gpu_avg = sum(gpu_duty_vals) / len(gpu_duty_vals)
            active_count = sum(1 for v in gpu_duty_vals if v > 10)
            idle_count = len(gpu_duty_vals) - active_count
            if overall_gpu_avg < 10:
                anomalies.append(
                    Anomaly(
                        "resource",
                        f"{role} GPU DutyCycle",
                        "warning",
                        f"Worker 整体 GPU 利用率仅 {overall_gpu_avg:.1f}%"
                        f"（{active_count}/{len(gpu_duty_vals)} 活跃），GPU 未充分利用",
                        f"avg={overall_gpu_avg:.1f}% ({active_count}/{len(gpu_duty_vals)} 活跃)",
                        ">10%",
                    )
                )
            elif idle_count > 0 and active_count > 0:
                anomalies.append(
                    Anomaly(
                        "resource",
                        f"{role} GPU DutyCycle",
                        "info",
                        f"Worker {idle_count}/{len(gpu_duty_vals)} 台 GPU 空闲"
                        f"（整体平均 {overall_gpu_avg:.1f}%），可能为正常分布式训练模式",
                        f"avg={overall_gpu_avg:.1f}% ({idle_count}/{len(gpu_duty_vals)} 空闲)",
                        "所有 GPU 活跃",
                    )
                )

        # 内存信息展示（mem_rss vs mem_limit 仅供参考，不作为 OOM 最终判定）
        effective_mem = mem_rss_max if mem_rss_max is not None else mem_usage_max
        mem_label = "mem_rss" if mem_rss_max is not None else "mem_usage"
        if effective_mem is not None and mem_limit_max is not None and mem_limit_max > 0:
            ratio = effective_mem / mem_limit_max
            eff_gb = effective_mem / (1024**3)
            limit_gb = mem_limit_max / (1024**3)
            cache_dominated = (
                mem_label == "mem_usage"
                and mem_cache_max is not None
                and mem_usage_max is not None
                and mem_cache_max > mem_usage_max * 0.8
            )
            if ratio > 1.0 and not cache_dominated:
                anomalies.append(
                    Anomaly(
                        "resource",
                        f"{role} Memory",
                        "warning",
                        f"{role} {mem_label} {eff_gb:.1f}GB 超过 limit {limit_gb:.1f}GB（{ratio:.0%}）"
                        f"（注意：mem_limit 来自 Arnold Role 看板，可能不准确，"
                        f"以 unreclaimable_ratio 为 OOM 判定依据）",
                        f"{mem_label}={eff_gb:.1f}GB limit={limit_gb:.1f}GB ({ratio:.0%})",
                        f"{mem_label} < limit",
                    )
                )
            elif ratio > 1.0 and cache_dominated:
                cache_gb = mem_cache_max / (1024**3) if mem_cache_max else 0
                anomalies.append(
                    Anomaly(
                        "resource",
                        f"{role} Memory",
                        "info",
                        f"{role} mem_usage {eff_gb:.1f}GB 超过 limit {limit_gb:.1f}GB，"
                        f"但 cache 占 {cache_gb:.1f}GB（可回收），实际 OOM 风险较低",
                        f"usage={eff_gb:.1f}GB cache={cache_gb:.1f}GB limit={limit_gb:.1f}GB",
                        "usage - cache < limit",
                    )
                )
            elif ratio > 0.9:
                anomalies.append(
                    Anomaly(
                        "resource",
                        f"{role} Memory",
                        "info",
                        f"{role} {mem_label} {eff_gb:.1f}GB 接近 limit {limit_gb:.1f}GB（{ratio:.0%}）",
                        f"{mem_label}={eff_gb:.1f}GB limit={limit_gb:.1f}GB ({ratio:.0%})",
                        f"{mem_label} < 90% limit",
                    )
                )

        # OOM 判定（权威依据）：Arnold Container 看板 Panel 91 unreclaimable_ratio
        unreclaimable = [m for m in metrics if m.panel_id == 91 and m.max is not None]
        for m in unreclaimable:
            if m.max >= 0.95:
                anomalies.append(
                    Anomaly(
                        "resource",
                        f"{role} OOM (unreclaimable_ratio)",
                        "critical",
                        f"{role} 不可回收内存比率 max={m.max:.1%}，已触发或接近 OOM",
                        f"avg={m.avg:.1%} max={m.max:.1%}" if m.avg is not None else f"max={m.max:.1%}",
                        "<90%",
                    )
                )
            elif m.max >= 0.8:
                anomalies.append(
                    Anomaly(
                        "resource",
                        f"{role} OOM 风险 (unreclaimable_ratio)",
                        "warning",
                        f"{role} 不可回收内存比率 max={m.max:.1%}，存在 OOM 风险",
                        f"avg={m.avg:.1%} max={m.max:.1%}" if m.avg is not None else f"max={m.max:.1%}",
                        "<80%",
                    )
                )

    # 任务状态
    if report.status and report.status.upper() in ("FAILED", "TIMEOUT"):
        anomalies.insert(
            0,
            Anomaly(
                "evals",
                "任务状态",
                "critical",
                f"任务状态: {report.status}",
                report.status,
                "SUCCESS",
            ),
        )

    return anomalies


# ── 报告生成 ────────────────────────────────────────────────────────────────────

SEVERITY_EMOJI = {"critical": "🔴", "warning": "🟡", "info": "🔵"}


def format_value(val: Optional[float], unit: str = "", divisor: float = 1.0) -> str:
    """格式化数值显示。"""
    if val is None:
        return "N/A"
    v = val / divisor
    if abs(v) >= 1000:
        return f"{v:,.0f}{unit}"
    if abs(v) >= 10:
        return f"{v:.1f}{unit}"
    return f"{v:.2f}{unit}"


def generate_markdown(report: HealthReport) -> str:
    """生成 Markdown 格式报告。"""
    lines = []
    is_trial_mode = report.eval_sid.startswith("trial:")
    title = "Job 任务健康检查报告" if is_trial_mode else "Arena 任务健康检查报告"
    lines.append(f"# {title}")
    lines.append("")

    # ── 任务概况 ──
    lines.append("## 任务概况")
    lines.append("")
    lines.append("| 属性 | 值 |")
    lines.append("|------|-----|")
    if is_trial_mode:
        lines.append(f"| trial_id | `{report.arnold_trial_id}` |")
    else:
        lines.append(f"| evaluation_task_sid | `{report.eval_sid}` |")
    if report.arena_sid:
        lines.append(f"| arena_sid | `{report.arena_sid}` |")
    lines.append(f"| 状态 | **{report.status}** |")
    if report.creator:
        lines.append(f"| 创建者 | {report.creator} |")
    if report.created_at:
        lines.append(f"| 创建时间 | {report.created_at} |")
    if report.completed_at:
        lines.append(f"| 完成时间 | {report.completed_at} |")
    if report.arnold_trial_id:
        lines.append(f"| arnold_trial_id | `{report.arnold_trial_id}` |")
    if report.cluster:
        lines.append(f"| cluster / dc | `{report.cluster}` / `{report.dc}` |")

    # 资源配置
    rc = report.resource_config
    if rc:
        lines.append("")
        lines.append("### 资源配置")
        lines.append("")
        for k, v in rc.items():
            lines.append(f"- **{k}**: {v}")

    # ── 异常摘要 ──
    lines.append("")
    lines.append("## 异常摘要")
    lines.append("")

    if not report.anomalies:
        lines.append("> ✅ 未检测到异常")
    else:
        critical = [a for a in report.anomalies if a.severity == "critical"]
        warning = [a for a in report.anomalies if a.severity == "warning"]
        info = [a for a in report.anomalies if a.severity == "info"]

        lines.append(
            f"共发现 **{len(report.anomalies)}** 项异常"
            f"（🔴 严重 {len(critical)} / 🟡 警告 {len(warning)} / 🔵 提示 {len(info)}）"
        )
        lines.append("")
        lines.append("| 级别 | 类别 | 指标 | 详情 | 当前值 | 阈值 |")
        lines.append("|------|------|------|------|--------|------|")
        for a in report.anomalies:
            emoji = SEVERITY_EMOJI.get(a.severity, "⚪")
            lines.append(f"| {emoji} | {a.category} | {a.metric} | {a.message} | {a.value} | {a.threshold} |")

    # ── Evals 业务指标 ──
    lines.append("")
    lines.append("## Evals 业务指标")
    lines.append("")

    if report.evals_metrics:
        # 按 panel_id 分组
        by_panel: dict[int, list[MetricSummary]] = {}
        for m in report.evals_metrics:
            by_panel.setdefault(m.panel_id, []).append(m)

        for panel_id, metrics in sorted(by_panel.items()):
            desc = EVALS_PANELS.get(panel_id, f"Panel {panel_id}")
            lines.append(f"### {desc} (Panel {panel_id})")
            lines.append("")
            lines.append("| 标签 | 平均值 | 最大值 | 最新值 |")
            lines.append("|------|--------|--------|--------|")
            for m in metrics[:10]:
                tag_str = " ".join(f"{k}={v}" for k, v in m.tags.items() if k not in ("instance_id",))
                lines.append(
                    f"| {tag_str[:60]} | {format_value(m.avg)} | {format_value(m.max)} | {format_value(m.last)} |"
                )
            lines.append("")
    else:
        lines.append("> 未采集到 Evals 业务指标")

    # ── Arnold 资源指标 ──
    lines.append("")
    lines.append("## Arnold 容器资源指标")
    lines.append("")

    if report.arnold_metrics:
        for role, metrics in report.arnold_metrics.items():
            lines.append(f"### {role} 节点")
            lines.append("")

            if not metrics:
                lines.append(f"> {role} 无数据")
                lines.append("")
                continue

            by_panel: dict[int, list[MetricSummary]] = {}
            for m in metrics:
                by_panel.setdefault(m.panel_id, []).append(m)

            for panel_id, panel_metrics in sorted(by_panel.items()):
                desc = ARNOLD_PANELS.get(panel_id, CONTAINER_OOM_PANELS.get(panel_id, f"Panel {panel_id}"))
                lines.append(f"**{desc}** (Panel {panel_id})")
                lines.append("")
                lines.append("| 指标 | 平均值 | 最大值 |")
                lines.append("|------|--------|--------|")
                for m in panel_metrics[:10]:
                    # unreclaimable_ratio: 0-1 比率，显示为百分比
                    if m.panel_id == 91:
                        avg_s = f"{m.avg:.1%}" if m.avg is not None else "N/A"
                        max_s = f"{m.max:.1%}" if m.max is not None else "N/A"
                    # 内存指标转 GB
                    elif "mem" in m.name and m.avg is not None and m.avg > 1024 * 1024 * 1024:
                        avg_s = format_value(m.avg, "GB", 1024**3)
                        max_s = format_value(m.max, "GB", 1024**3)
                    # 磁盘指标转 GB
                    elif "disk" in m.name and m.avg is not None and m.avg > 1024 * 1024 * 1024:
                        avg_s = format_value(m.avg, "GB", 1024**3)
                        max_s = format_value(m.max, "GB", 1024**3)
                    # 网络指标转 MB/s
                    elif "network" in m.name and m.avg is not None and m.avg > 1024 * 1024:
                        avg_s = format_value(m.avg, "MB/s", 1024**2)
                        max_s = format_value(m.max, "MB/s", 1024**2)
                    else:
                        avg_s = format_value(m.avg)
                        max_s = format_value(m.max)

                    short = m.name.split(".")[-1] if m.name else "?"
                    lines.append(f"| {short} | {avg_s} | {max_s} |")
                lines.append("")
    else:
        lines.append("> 未采集到 Arnold 资源指标")

    # ── Grafana 链接 ──
    if report.grafana_urls:
        lines.append("")
        lines.append("## Grafana 看板链接")
        lines.append("")
        for name, url in report.grafana_urls.items():
            lines.append(f"- [{name}]({url})")

    return "\n".join(lines)


def generate_html(report: HealthReport) -> str:
    """生成独立 HTML 报告。"""
    md = generate_markdown(report)
    # 简易 HTML 包装，用 marked.js 渲染 Markdown
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Arena 健康检查 - {report.eval_sid}</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; background: #f8f9fa; }}
  .report {{ background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
  table {{ border-collapse: collapse; width: 100%; margin: 10px 0; }}
  th, td {{ border: 1px solid #ddd; padding: 8px 12px; text-align: left; }}
  th {{ background: #f0f0f0; }}
  code {{ background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }}
  h1 {{ color: #333; }} h2 {{ color: #555; border-bottom: 1px solid #eee; padding-bottom: 8px; }}
</style>
</head>
<body>
<div class="report" id="content"></div>
<script>
document.getElementById('content').innerHTML = marked.parse({json.dumps(md)});
</script>
</body>
</html>"""


# ── 主流程 ──────────────────────────────────────────────────────────────────────


def parse_arena_url(url: str) -> tuple[str, str]:
    """从 Arena URL 中解析 arena_sid 和 evaluation_task_sid。"""
    parsed = urlparse(url)
    # /evaluation/arena/<arena_sid>
    path_parts = parsed.path.strip("/").split("/")
    arena_sid = ""
    for i, part in enumerate(path_parts):
        if part == "arena" and i + 1 < len(path_parts):
            arena_sid = path_parts[i + 1]
            break
    qs = parse_qs(parsed.query)
    eval_sid = qs.get("evaluation_task_sid", [""])[0]
    return arena_sid, eval_sid


def iso_to_ms(iso_str: str) -> int:
    """ISO 时间字符串转毫秒时间戳，正确处理 UTC 时区。"""
    import re
    from datetime import datetime, timezone

    # 去掉 'T'，保留时区信息用于判断
    clean = re.sub(r"T", " ", iso_str).strip()
    # 移除尾部 Z 或 +00:00 等时区标记（统一当 UTC 处理）
    clean = re.sub(r"Z$", "", clean).strip()
    clean = re.sub(r"[+-]\d{2}:\d{2}$", "", clean).strip()
    try:
        dt = datetime.strptime(clean, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        return int(dt.timestamp() * 1000)
    except ValueError:
        return 0


def run_health_check(
    eval_sid: str = "", arena_url: str = "", trial_id: str = "", output_format: str = "markdown"
) -> HealthReport:
    """执行完整的健康检查流程。

    支持两种入口：
    - Arena 模式：通过 eval_sid 或 arena_url 获取完整任务信息 + Arnold 资源
    - Job 模式：通过 trial_id 直接查询 Arnold 资源指标（跳过 Evals 业务指标）
    """
    # 1. 解析输入，确定运行模式
    if arena_url and not eval_sid:
        _, eval_sid = parse_arena_url(arena_url)

    # trial_id 模式：跳过 Arena，直接查 Arnold
    is_trial_mode = bool(trial_id) and not eval_sid

    if not eval_sid and not trial_id:
        print("错误：必须提供 --eval-sid、--arena-url 或 --trial-id", file=sys.stderr)
        sys.exit(1)

    report = HealthReport(eval_sid=eval_sid or f"trial:{trial_id}")

    if is_trial_mode:
        # ── Job 模式 ──
        print(f"[1/6] Job 模式，trial_id={trial_id}（跳过 Arena 信息获取）", file=sys.stderr)
        report.arnold_trial_id = trial_id
        report.status = "RUNNING"  # 默认假定运行中

        # 时间范围：默认最近 1 小时
        to_ms = int(time.time() * 1000)
        from_ms = to_ms - 3600 * 1000
    else:
        # ── Arena 模式 ──
        print(f"[1/6] 获取 Arena 任务信息 (eval_sid={eval_sid})...", file=sys.stderr)
        raw_info = get_arena_info(eval_sid)

        # merlin-cli 返回 {"arena_evaluation": {...}}，取内层
        info = raw_info.get("arena_evaluation", raw_info) if raw_info else {}

        if info:
            report.arena_sid = info.get("arena_sid", "")
            report.status = info.get("status", "")
            report.creator = info.get("creator", "")
            report.created_at = info.get("created_at", "")
            report.completed_at = info.get("completed_at", "")

            # 提取最近的 trial（列表按时间倒序，第一个是最新的）
            trials = info.get("arnold_trial_brief", [])
            if trials:
                latest_trial = trials[0]
                report.arnold_trial_id = str(latest_trial.get("trial_id", ""))

            # 资源配置
            rc = info.get("resource_config", {})
            if rc:
                report.resource_config = rc

        # 如果 arena 信息中有 trial_id，但用户也传了 --trial-id，优先用用户的
        if trial_id:
            report.arnold_trial_id = trial_id

        if not report.arnold_trial_id:
            print("警告：未找到 arnold_trial_id，无法查询 Arnold 资源指标", file=sys.stderr)

        # 计算时间范围
        MAX_RANGE_MS = 6 * 3600 * 1000
        from_ms = iso_to_ms(report.created_at) if report.created_at else 0
        to_ms = iso_to_ms(report.completed_at) if report.completed_at else int(time.time() * 1000)
        if from_ms == 0:
            from_ms = to_ms - 3600 * 1000
        elif to_ms - from_ms > MAX_RANGE_MS:
            print("  时间范围超过 6 小时，自动截取最后 6 小时", file=sys.stderr)
            from_ms = to_ms - MAX_RANGE_MS

    # 2. 获取 cluster 信息
    print(f"[2/6] 获取 Grafana URL (trial_id={report.arnold_trial_id})...", file=sys.stderr)
    if report.arnold_trial_id:
        grafana_info = get_grafana_url(report.arnold_trial_id)
        if grafana_info:
            url_str = grafana_info.get("grafana_url", "") or grafana_info.get("url", "")
            if url_str:
                qs = parse_qs(urlparse(url_str).query)
                report.cluster = qs.get("var-cluster", [""])[0]
                report.dc = qs.get("var-dc", [""])[0]
                if not report.cluster:
                    print("  警告：Grafana URL 中未包含 var-cluster", file=sys.stderr)

    # 3. 加载 JWT
    jwt = load_jwt()

    # 4. 构造所有面板查询任务，一次性并行采集
    tasks: list[tuple[str, int, str, str]] = []  # (url, panel_id, desc, group)

    if not is_trial_mode:
        evals_url = (
            f"{EVALS_BASE}?orgId=1"
            f"&var-arena_instance_id={eval_sid}"
            f"&var-arnold_trial_id={report.arnold_trial_id}"
            f"&var-exercise_version_sid=*&var-iteration_stage=*"
            f"&from={from_ms}&to={to_ms}"
        )
        for pid, desc in EVALS_PANELS.items():
            tasks.append((evals_url, pid, desc, "evals"))

    if report.arnold_trial_id and report.cluster:
        for role in ["head", "worker"]:
            arnold_url = (
                f"{ARNOLD_ROLE_BASE}?orgId=1"
                f"&var-cluster={report.cluster}&var-job_psm={job_psm_var()}"
                f"&var-target_arnold_trial_id={report.arnold_trial_id}"
                f"&var-target_arnold_role={role}"
                f"&var-dc={report.dc}&var-task_family=arnold"
                f"&var-metricsBytedIsGroupByRegion__=true"
                f"&var-metricsBytedVRegion__=China-North"
                f"&var-hostnum=All&var-eth_name=All"
                f"&var-hdfs_task_family=arnold"
                f"&var-hdfs_tenant=default&var-hdfs_datasource=bytetsd"
                f"&from={from_ms}&to={to_ms}"
            )
            for pid, desc in ARNOLD_PANELS.items():
                tasks.append((arnold_url, pid, desc, f"arnold_{role}"))

    # Arnold Container 看板：unreclaimable_ratio（OOM 判定权威依据，不依赖 cluster）
    if report.arnold_trial_id:
        for role in ["head", "worker"]:
            pod_name = f"trial-{report.arnold_trial_id}-trialrun-{report.arnold_trial_id}-{role}-0"
            task_id_var = f"arnold-trial-{report.arnold_trial_id}-trialrun-{report.arnold_trial_id}-{role}-0"
            container_url = (
                f"{ARNOLD_CONTAINER_BASE}?orgId=1"
                f"&var-job_psm={job_psm_var()}"
                f"&var-arnold_task_index=0"
                f"&var-task_id={task_id_var}"
                f"&var-arnold_trial_id={report.arnold_trial_id}"
                f"&var-arnold_role={role}"
                f"&var-podName={pod_name}"
                f"&var-task_family=arnold"
                f"&var-cluster=All&var-dc=All"
                f"&var-eth_name=All&var-hostnum=All"
                f"&var-metricsBytedIsGroupByRegion__=true"
                f"&var-metricsBytedVRegion__=All"
                f"&var-hdfs_tenant=default&var-hdfs_datasource=bytetsd"
                f"&from={from_ms}&to={to_ms}"
            )
            for pid, desc in CONTAINER_OOM_PANELS.items():
                tasks.append((container_url, pid, desc, f"arnold_{role}"))

    print(f"[3/5] 并行采集所有指标（{len(tasks)} 个面板）...", file=sys.stderr)
    t_start = time.time()
    with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as pool:
        future_map = {
            pool.submit(_query_and_parse, jwt, url, pid, desc): group
            for url, pid, desc, group in tasks
        }
        for future in as_completed(future_map):
            group = future_map[future]
            stats = future.result()
            if group == "evals":
                report.evals_metrics.extend(stats)
            elif group == "arnold_head":
                report.arnold_metrics.setdefault("head", []).extend(stats)
            elif group == "arnold_worker":
                report.arnold_metrics.setdefault("worker", []).extend(stats)
    elapsed = time.time() - t_start
    print(
        f"       完成：evals={len(report.evals_metrics)}, "
        f"head={len(report.arnold_metrics.get('head', []))}, "
        f"worker={len(report.arnold_metrics.get('worker', []))} 条时间序列 ({elapsed:.1f}s)",
        file=sys.stderr,
    )

    # 5. 异常检测
    print("[4/5] 执行异常检测...", file=sys.stderr)
    report.anomalies = detect_anomalies(report)
    print(f"       发现 {len(report.anomalies)} 项异常", file=sys.stderr)

    # 7. 构造 Grafana 链接
    if report.eval_sid and not report.eval_sid.startswith("trial:"):
        report.grafana_urls["Evals 看板"] = (
            f"{EVALS_BASE}?orgId=1"
            f"&var-arena_instance_id={report.eval_sid}"
            f"&var-arnold_trial_id={report.arnold_trial_id}"
            f"&from={from_ms}&to={to_ms}"
        )
    if report.cluster and report.arnold_trial_id:
        report.grafana_urls["Arnold Role 看板 (head)"] = (
            f"{ARNOLD_ROLE_BASE}?orgId=1"
            f"&var-cluster={report.cluster}&var-dc={report.dc}"
            f"&var-target_arnold_trial_id={report.arnold_trial_id}"
            f"&var-target_arnold_role=head"
            f"&var-task_family=arnold"
            f"&from={from_ms}&to={to_ms}"
        )
        report.grafana_urls["Arnold Role 看板 (worker)"] = (
            f"{ARNOLD_ROLE_BASE}?orgId=1"
            f"&var-cluster={report.cluster}&var-dc={report.dc}"
            f"&var-target_arnold_trial_id={report.arnold_trial_id}"
            f"&var-target_arnold_role=worker"
            f"&var-task_family=arnold"
            f"&from={from_ms}&to={to_ms}"
        )
    if report.arnold_trial_id:
        for role in ["head", "worker"]:
            pod_name = f"trial-{report.arnold_trial_id}-trialrun-{report.arnold_trial_id}-{role}-0"
            task_id_var = f"arnold-trial-{report.arnold_trial_id}-trialrun-{report.arnold_trial_id}-{role}-0"
            report.grafana_urls[f"Arnold Container 看板 ({role})"] = (
                f"{ARNOLD_CONTAINER_BASE}?orgId=1"
                f"&var-job_psm={job_psm_var()}"
                f"&var-arnold_task_index=0"
                f"&var-task_id={task_id_var}"
                f"&var-arnold_trial_id={report.arnold_trial_id}"
                f"&var-arnold_role={role}"
                f"&var-podName={pod_name}"
                f"&var-task_family=arnold"
                f"&var-cluster=All&var-dc=All"
                f"&from={from_ms}&to={to_ms}"
            )

    # 6. 输出报告
    print("[5/5] 生成报告...", file=sys.stderr)
    return report


def main() -> None:
    """CLI 入口。"""
    parser = argparse.ArgumentParser(description="Arena / Job 任务健康检查")
    parser.add_argument("--eval-sid", help="evaluation_task_sid（Arena 模式）")
    parser.add_argument("--arena-url", help="Arena 页面 URL（自动解析 eval_sid）")
    parser.add_argument("--trial-id", help="arnold_trial_id（Job 模式，直接查 Arnold 资源）")
    parser.add_argument(
        "--format", choices=["markdown", "html", "json"], default="markdown", help="输出格式（默认 markdown）"
    )
    parser.add_argument("--output", "-o", help="输出文件路径（不指定则输出到 stdout）")
    args = parser.parse_args()

    report = run_health_check(
        eval_sid=args.eval_sid or "",
        arena_url=args.arena_url or "",
        trial_id=args.trial_id or "",
        output_format=args.format,
    )

    # 生成输出
    if args.format == "json":
        from dataclasses import asdict

        content = json.dumps(asdict(report), indent=2, ensure_ascii=False, default=str)
    elif args.format == "html":
        content = generate_html(report)
    else:
        content = generate_markdown(report)

    if args.output:
        Path(args.output).write_text(content, encoding="utf-8")
        print(f"\n报告已保存: {args.output}", file=sys.stderr)
    else:
        print(content)


if __name__ == "__main__":
    main()
