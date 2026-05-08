#!/usr/bin/env python3
"""Diagnose a failed Arena evaluation task by analyzing all nodes
(inference server, preshard, evaluation/ray job) and producing
a structured failure report.

Usage:
    python3 diagnose_arena_task.py --url "<arena_url_or_evaluation_task_sid>" \
        [--control-plane cn-seed] \
        [--out-dir ./arena_diagnosis] \
        [--log-tail-lines 120]
"""

import argparse
import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence
from urllib.parse import parse_qs, urlparse


@dataclass
class NodeDiagnosis:
    """One logical node (e.g. Ray head/worker) and its exit diagnosis."""

    name: str
    status: str
    exit_code: Optional[int] = None
    error_info: str = ""
    key_logs: List[str] = field(default_factory=list)
    conclusion: str = ""


@dataclass
class ExerciseStatus:
    """Progress for a single exercise from Arena ``progress.detail``."""

    key: str
    completed: int
    total: int
    status: str
    exercise_version_sid: str = ""


@dataclass
class RayLogAnalysis:
    """Parsed signals from Ray / evals log text (tracebacks, ExceptionManager)."""

    first_traceback: str = ""
    exception_manager_root_causes: str = ""
    exception_manager_process_exits: List[str] = field(default_factory=list)
    evals_errors: List[str] = field(default_factory=list)
    has_evals_error: bool = False


@dataclass
class DiagnosisReport:
    """Structured Arena evaluation failure report for markdown / stdout output."""

    evaluation_task_sid: str = ""
    arena_sid: str = ""
    job_run_id: str = ""
    trial_id: str = ""
    overall_status: str = ""
    created_at: str = ""
    completed_at: str = ""
    creator: str = ""
    model_path: str = ""
    root_cause: str = ""
    nodes: List[NodeDiagnosis] = field(default_factory=list)
    exercises: List[ExerciseStatus] = field(default_factory=list)
    exercise_summary: str = ""
    recommendations: List[str] = field(default_factory=list)
    ray_log_analysis: Optional[RayLogAnalysis] = None


def run_merlin_cli(args: Sequence[str], control_plane: str = "cn-seed") -> Dict[str, Any]:
    cmd = ["merlin-cli", "--control-plane", control_plane, *args]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"merlin-cli failed: {' '.join(cmd)}\n{p.stderr.strip()}")
    out = p.stdout.strip()
    if not out:
        return {}
    try:
        return json.loads(out)
    except Exception:
        return {"raw_output": out[:5000]}


def extract_sid(url_or_sid: str) -> str:
    s = url_or_sid.strip()
    if re.fullmatch(r"[a-z0-9]{10,64}", s):
        return s
    u = urlparse(s)
    qs = parse_qs(u.query or "")
    sid = (qs.get("evaluation_task_sid") or [""])[0].strip()
    if not sid:
        raise RuntimeError("Cannot find evaluation_task_sid in URL query")
    return sid


def download_log(url: str, max_time: int = 30) -> str:
    try:
        p = subprocess.run(
            ["curl", "-sS", "--max-time", str(max_time), url],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env={"no_proxy": "*", "PATH": subprocess.os.environ.get("PATH", "/usr/bin")},
        )
        if p.returncode != 0:
            url_alt = url.replace("tosv.byted.org", "cdn-tos-cn.bytedance.net")
            if url_alt != url:
                p = subprocess.run(
                    ["curl", "-sS", "--max-time", str(max_time), url_alt],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    env={"no_proxy": "*", "PATH": subprocess.os.environ.get("PATH", "/usr/bin")},
                )
        return p.stdout
    except Exception as e:
        return f"[Failed to download log: {e}]"


EXCEPTION_LINE_RE = re.compile(
    r"^(ModuleNotFoundError|ImportError|RuntimeError|IndexError|KeyError|"
    r"ValueError|TypeError|AttributeError|FileNotFoundError|NameError|"
    r"OSError|IOError|PermissionError|TimeoutError|ConnectionError|"
    r"NotImplementedError|StopIteration|SystemExit|AssertionError|"
    r"bytedance\.\S+Error|CustomRetryableError)\b"
)

EVALS_ERROR_PATTERNS = [
    re.compile(r"ModuleNotFoundError:\s*No module named"),
    re.compile(r"ImportError:\s*"),
    re.compile(r"RuntimeError:\s*Exercise version SID.*is not supported"),
    re.compile(r"IndexError:\s*"),
    re.compile(r"KeyError:\s*"),
    re.compile(r"ValueError:\s*"),
    re.compile(r"TypeError:\s*"),
    re.compile(r"AttributeError:\s*"),
    re.compile(r"FileNotFoundError:\s*"),
]


def analyze_ray_log(log_text: str) -> RayLogAnalysis:
    """Deep analysis of ray_log to find the real evals error."""
    analysis = RayLogAnalysis()
    lines = log_text.splitlines()

    # 1. Find ExceptionManager root causes and process exits
    for line in lines:
        if "ExceptionManager" in line and "Root causes" in line:
            analysis.exception_manager_root_causes = line.strip()
        if "ExceptionManager" in line and "exit with code" in line:
            analysis.exception_manager_process_exits.append(line.strip())

    # 2. Find tracebacks — collect complete tracebacks including the final error line
    traceback_buf: List[str] = []
    in_traceback = False

    def _strip_actor_prefix(s: str) -> str:
        """Strip Ray Actor log prefix like '(ActorClassName=..., pid=...) '"""
        if s.startswith("(") and ") " in s:
            idx = s.index(") ")
            return s[idx + 2 :]
        return s

    for line in lines:
        stripped = line.strip()
        # Strip actor prefix for traceback detection
        content = _strip_actor_prefix(stripped)
        # For indentation check, strip only actor prefix from original line (keep leading spaces)
        raw_content = _strip_actor_prefix(line)

        if "Traceback (most recent call last):" in line:
            if in_traceback and traceback_buf:
                _save_traceback(analysis, traceback_buf)
            in_traceback = True
            traceback_buf = [line]
            continue

        if in_traceback:
            traceback_buf.append(line)
            if not content:
                continue
            if content.startswith("File ") or content.startswith('File "'):
                continue
            if content.startswith("^") or content.startswith("~"):
                continue
            if "raise " in content or "return " in content:
                continue
            # Check indentation on raw line (not stripped) — traceback code lines are indented
            if raw_content.startswith("    ") or raw_content.startswith("\t"):
                continue
            # Final error line (e.g. "RuntimeError: ...", "IndexError: ...")
            if EXCEPTION_LINE_RE.match(content):
                _save_traceback(analysis, traceback_buf)
                in_traceback = False
                continue
            # Some other non-traceback line, end the traceback
            _save_traceback(analysis, traceback_buf)
            in_traceback = False

    if in_traceback and traceback_buf:
        _save_traceback(analysis, traceback_buf)

    # 3. Search entire log for specific error patterns (grep-style, catches single-line errors)
    for line in lines:
        for pat in EVALS_ERROR_PATTERNS:
            if pat.search(line):
                err_line = line.strip()
                if err_line not in [e.strip() for e in analysis.evals_errors]:
                    analysis.evals_errors.append(err_line)
                break

    analysis.has_evals_error = bool(analysis.first_traceback or analysis.evals_errors)
    return analysis


def _save_traceback(analysis: RayLogAnalysis, traceback_buf: List[str]) -> None:
    tb_text = "\n".join(traceback_buf)
    # Skip the generic "Evaluation failed abnormally" wrapper traceback
    if "Evaluation failed abnormally" in tb_text and "cleanup_all" in tb_text:
        return
    if not analysis.first_traceback:
        analysis.first_traceback = tb_text
    analysis.evals_errors.append(tb_text)


OOM_PATTERNS = [
    re.compile(r"Memory cgroup out of memory", re.IGNORECASE),
    re.compile(r"Killed process .* total-vm", re.IGNORECASE),
]

INFERENCE_FAIL_PATTERNS = [
    re.compile(r"get_one_request_url got empty url"),
    re.compile(r"XGPTServerAPI"),
]


def classify_log_errors(log_text: str) -> Dict[str, List[str]]:
    results: Dict[str, List[str]] = {
        "oom": [],
        "inference_fail": [],
    }
    for line in log_text.splitlines():
        for pat in OOM_PATTERNS:
            if pat.search(line):
                results["oom"].append(line.strip())
                break
        for pat in INFERENCE_FAIL_PATTERNS:
            if pat.search(line):
                results["inference_fail"].append(line.strip())
                break
    for k in results:
        results[k] = results[k][:5]
    return results


def diagnose(url_or_sid: str, control_plane: str, log_tail_lines: int) -> DiagnosisReport:
    report = DiagnosisReport()
    sid = extract_sid(url_or_sid)
    report.evaluation_task_sid = sid

    eval_data = run_merlin_cli(["arena", "get-evaluation", "--json", json.dumps({"sid": sid})], control_plane)
    ev = eval_data.get("arena_evaluation", eval_data.get("evaluation", {}))

    report.arena_sid = ev.get("arena_sid", "")
    report.overall_status = ev.get("status", "UNKNOWN")
    report.created_at = ev.get("created_at", "")
    report.completed_at = ev.get("completed_at", "")
    report.job_run_id = ev.get("job_run_id", "")
    report.creator = ev.get("creator", "")
    report.model_path = ev.get("model_path", "")

    trials = ev.get("arnold_trial_brief", [])
    if trials:
        report.trial_id = str(trials[-1].get("trial_id", ""))

    extra = ev.get("extra", {})
    conf = ev.get("conf", {})

    # --- Inference server nodes ---
    inf_status = extra.get("enable_inference_server_create_status", "")
    inf_reason = extra.get("enable_inference_server_create_failed_reason", "")
    inf_enabled = extra.get("enable_inference_server", False) or conf.get("inference_engine", "")

    if inf_enabled:
        inf_nodes = conf.get("inference_engine_job_def_version", [])
        for node_def in inf_nodes:
            node_name = node_def.get("node_name", node_def.get("mark", "InferenceNode"))
            mark = node_def.get("mark", "")
            node = NodeDiagnosis(name=node_name, status="UNKNOWN")

            if "FAILED" in inf_status:
                if node_name in inf_reason or mark in inf_reason:
                    node.status = "FAILED"
                    node.error_info = inf_reason
                    node.conclusion = f"{node_name} 创建失败: {inf_reason}"
                elif inf_reason:
                    node.status = "POSSIBLY_FAILED"
                    node.error_info = inf_reason
                    node.conclusion = f"推理服务整体失败 ({inf_status}), 原因: {inf_reason}"
                else:
                    node.status = "FAILED"
                    node.conclusion = f"推理服务创建失败 ({inf_status})"
            elif inf_status:
                node.status = inf_status
            else:
                node.status = "NO_STATUS_INFO"

            report.nodes.append(node)

        if not inf_nodes and inf_status:
            node = NodeDiagnosis(
                name="InferenceServer",
                status=inf_status,
                error_info=inf_reason,
                conclusion=f"推理服务状态: {inf_status}, 原因: {inf_reason}",
            )
            report.nodes.append(node)

    # --- Evaluation node (Merlin Job) ---
    ray_log_analysis = RayLogAnalysis()

    if report.job_run_id and report.trial_id:
        exit_info = run_merlin_cli(
            [
                "job",
                "list-trial-exit-info",
                "--json",
                json.dumps(
                    {
                        "job_run_id": report.job_run_id,
                        "trial_id": report.trial_id,
                    }
                ),
            ],
            control_plane,
        )
        pods = exit_info.get("list", [])
        for pod in pods:
            pod_name = pod.get("pod_name", "unknown")
            exit_code = pod.get("exit_code")
            error_info_text = pod.get("errorInfo", "")
            meta = pod.get("meta", {})
            role = "head" if "head" in pod_name else "worker"

            node = NodeDiagnosis(
                name=f"评估节点 ({role}: {pod_name})",
                status=meta.get("status", "unknown"),
                exit_code=exit_code,
                error_info=error_info_text,
            )

            if exit_code == 0:
                node.conclusion = "正常退出"
            elif exit_code == 1:
                node.conclusion = "应用层错误，需查看日志详情"
            elif exit_code == 137:
                node.conclusion = "被 SIGKILL (OOM Killed)"
            elif exit_code == 255:
                node.conclusion = "用户脚本异常退出 (exit code 255)"
            elif exit_code == 60007:
                node.conclusion = "实例被删除 (可能被抢占)"
            else:
                node.conclusion = f"异常退出码: {exit_code}"

            report.nodes.append(node)

        # --- Download and analyze ALL logs ---
        log_data = run_merlin_cli(
            [
                "job",
                "list-trial-logs",
                "--json",
                json.dumps(
                    {
                        "job_run_id": report.job_run_id,
                        "trial_id": report.trial_id,
                    }
                ),
            ],
            control_plane,
        )
        log_list = log_data.get("log_list", [])

        for log_entry in log_list:
            log_url = log_entry.get("url", "")
            log_type = log_entry.get("type", "")
            log_pod = log_entry.get("pod_name", "")
            if not log_url:
                continue

            # Download full log for ray_log, tail for others
            if log_type == "ray_log":
                full_log = download_log(log_url, max_time=60)
                ray_log_analysis = analyze_ray_log(full_log)
                report.ray_log_analysis = ray_log_analysis

                # Also check for OOM/inference errors in ray_log
                errors = classify_log_errors(full_log)
                for node in report.nodes:
                    if "head" in node.name:
                        if errors["inference_fail"]:
                            node.key_logs.extend(
                                [f"[InferenceFail in ray_log] {l}" for l in errors["inference_fail"][:3]]
                            )
                        if errors["oom"]:
                            node.key_logs.extend([f"[OOM in ray_log] {l}" for l in errors["oom"][:3]])
                        if ray_log_analysis.exception_manager_root_causes:
                            node.key_logs.append(f"[ExceptionManager] {ray_log_analysis.exception_manager_root_causes}")
                        for pe in ray_log_analysis.exception_manager_process_exits[:3]:
                            node.key_logs.append(f"[ExceptionManager] {pe}")
                        if ray_log_analysis.first_traceback:
                            tb_lines = ray_log_analysis.first_traceback.splitlines()
                            last_line = tb_lines[-1].strip() if tb_lines else ""
                            node.key_logs.append(f"[EvalError] {last_line}")
                        break
            else:
                log_tail = "\n".join(download_log(log_url).splitlines()[-log_tail_lines:])
                errors = classify_log_errors(log_tail)
                pod_role = "head" if "head" in log_pod else ("worker" if "worker" in log_pod else "unknown")

                for node in report.nodes:
                    if log_pod and log_pod in node.name:
                        if errors["oom"]:
                            node.key_logs.extend([f"[OOM on {pod_role} {log_type}] {l}" for l in errors["oom"][:3]])
                        if errors["inference_fail"]:
                            node.key_logs.extend(
                                [f"[InferenceFail on {pod_role} {log_type}] {l}" for l in errors["inference_fail"][:3]]
                            )
                        break

    # --- Exercise analysis ---
    progress = ev.get("progress", {})
    detail = progress.get("detail", {})
    total_completed = 0
    total_total = 0
    failed_exercises = []
    completed_exercises = []
    not_started_exercises = []

    for ex_key, info in detail.items():
        completed = info.get("completed", 0)
        total = info.get("total", 0)
        status = info.get("status", "unknown")
        ev_sid = info.get("exercise_version_sid", "")
        ex = ExerciseStatus(key=ex_key, completed=completed, total=total, status=status, exercise_version_sid=ev_sid)
        report.exercises.append(ex)
        total_completed += completed
        total_total += total
        if status == "completed" and completed == total:
            completed_exercises.append(ex_key)
        elif completed == 0:
            not_started_exercises.append(ex_key)
        else:
            failed_exercises.append(ex_key)

    ep = ev.get("exercise_progress", {})
    ex_completed = ep.get("completed", len(completed_exercises))
    ex_failed = ep.get("failed", len(failed_exercises))
    ex_not_started = ep.get("not_started", len(not_started_exercises))
    ex_total = ep.get("total", len(report.exercises))

    report.exercise_summary = (
        f"共 {ex_total} 个 exercise: "
        f"{ex_completed} 个完成, {ex_failed} 个失败, {ex_not_started} 个未开始. "
        f"数据完成率: {total_completed}/{total_total} ({total_completed / total_total * 100:.1f}%)"
        if total_total > 0
        else f"共 {ex_total} 个 exercise"
    )

    # ===== ROOT CAUSE DETERMINATION (priority order) =====
    # Priority: ray_log evals error > ExceptionManager > OOM > inference server status

    inf_server_failed = any(
        n.status in ("FAILED", "CREATE_MERLIN_JOB_FAILED")
        for n in report.nodes
        if "Preshard" in n.name or "Serving" in n.name or "Inference" in n.name
    ) or ("FAILED" in inf_status)
    inf_is_platform_reclaim = "mlx" in inf_reason.lower() and "stop" in inf_reason.lower()

    has_inference_fail_logs = any("InferenceFail" in " ".join(n.key_logs) for n in report.nodes)

    eval_nodes = [n for n in report.nodes if "评估" in n.name]
    logs_available = any(n.key_logs for n in eval_nodes)

    oom_nodes = []
    for n in report.nodes:
        if any("OOM" in l for l in n.key_logs):
            role = "head" if "head" in n.name else ("worker" if "worker" in n.name else n.name)
            oom_nodes.append(role)
    has_oom = len(oom_nodes) > 0
    oom_is_root_cause = has_oom and any(
        n.exit_code == 137 or any("exit with code: -9" in l for l in n.key_logs) for n in report.nodes
    )
    oom_is_secondary = has_oom and not oom_is_root_cause

    root_causes = []
    secondary_effects = []

    # --- Priority 1: ray_log evals errors (most specific) ---
    if ray_log_analysis.has_evals_error:

        def _strip_actor_prefix(s: str) -> str:
            if s.startswith("(") and ") " in s:
                return s[s.index(") ") + 2 :]
            return s

        error_summary = ""
        # First try to find a clear exception line from the traceback
        if ray_log_analysis.first_traceback:
            tb_lines = ray_log_analysis.first_traceback.strip().splitlines()
            for tl in reversed(tb_lines):
                tl_s = _strip_actor_prefix(tl.strip())
                if tl_s and EXCEPTION_LINE_RE.match(tl_s):
                    error_summary = tl_s
                    break
        # If traceback didn't yield a clear exception, use grep-matched errors
        if not error_summary and ray_log_analysis.evals_errors:
            for err in ray_log_analysis.evals_errors:
                err_lines = err.strip().splitlines()
                for el in reversed(err_lines):
                    el_s = _strip_actor_prefix(el.strip())
                    if el_s and EXCEPTION_LINE_RE.match(el_s):
                        error_summary = el_s
                        break
                if error_summary:
                    break
        if not error_summary and ray_log_analysis.evals_errors:
            error_summary = _strip_actor_prefix(ray_log_analysis.evals_errors[0].strip().splitlines()[-1].strip())
        # Truncate if too long
        if len(error_summary) > 200:
            error_summary = error_summary[:200] + "..."
        root_causes.append(f"评估代码错误: {error_summary}")

        if ray_log_analysis.exception_manager_root_causes:
            m = re.search(
                r"Root causes of abnormal exit:\s*\[([^\]]+)\]", ray_log_analysis.exception_manager_root_causes
            )
            if m:
                root_causes.append(f"ExceptionManager 判定根因进程: {m.group(1)}")

        # If we found an evals error, inference server stop is secondary
        if inf_server_failed:
            secondary_effects.append(f"推理服务被停止 ({inf_reason}) — 可能是评估失败后的平台回收行为")

    # --- Priority 2: OOM as root cause ---
    elif oom_is_root_cause:
        oom_desc = f"评估 {'/'.join(oom_nodes)} 节点 OOM (进程被 SIGKILL)"
        root_causes.append(oom_desc)
        if ray_log_analysis.exception_manager_process_exits:
            for pe in ray_log_analysis.exception_manager_process_exits[:2]:
                root_causes.append(f"ExceptionManager: {pe}")
        if inf_server_failed:
            secondary_effects.append(f"推理服务被停止 ({inf_reason})")

    # --- Priority 3: inference server failure (only if no evals error found) ---
    elif inf_server_failed:
        if inf_is_platform_reclaim:
            if logs_available:
                secondary_effects.append(f"平台 (mlx) 自动停止了推理服务 — 评估失败后的资源回收行为 ({inf_reason})")
            else:
                secondary_effects.append(f"平台 (mlx) 自动停止了推理服务 ({inf_reason})")
        else:
            root_causes.append(f"推理服务节点失败 ({inf_reason or inf_status})")

        if has_inference_fail_logs and not inf_is_platform_reclaim:
            secondary_effects.append("评估节点因推理服务不可达而报错")

    # --- Priority 4: inference call failures without server-level failure ---
    elif has_inference_fail_logs:
        root_causes.append("推理服务调用失败 (服务不可达)")

    # --- OOM as secondary effect ---
    if oom_is_secondary:
        oom_desc = f"评估 {'/'.join(oom_nodes)} 节点检测到 OOM (内核 cgroup 杀死子进程，为伴随现象)"
        secondary_effects.append(oom_desc)

    # --- Fallback: exit codes ---
    if not root_causes:
        for n in report.nodes:
            if n.exit_code and n.exit_code not in (0, 60007):
                root_causes.append(f"{n.name} 异常退出 (exit code {n.exit_code})")

    # --- Format root cause ---
    if not root_causes and not logs_available:
        completed = report.completed_at or report.created_at
        try:
            completed_dt = datetime.fromisoformat(completed.replace("Z", "+00:00"))
            days_ago = (datetime.now(timezone.utc) - completed_dt).days
        except Exception:
            days_ago = -1
        report.root_cause = f"根因无法确定 — 任务距今已 {days_ago} 天，日志已过期清除"
        if secondary_effects:
            report.root_cause += "\n注意: " + "; ".join(secondary_effects)
        report.root_cause += "\n→ 评估任务整体 FAILED"
    elif root_causes:
        report.root_cause = "根因: " + " → ".join(root_causes)
        if secondary_effects:
            report.root_cause += "\n伴随现象: " + "; ".join(secondary_effects)
        report.root_cause += "\n→ 评估任务整体 FAILED"
    else:
        report.root_cause = "未能确定明确根因，建议手动查看日志"
        if secondary_effects:
            report.root_cause += "\n注意: " + "; ".join(secondary_effects)

    # --- Recommendations ---
    if ray_log_analysis.has_evals_error:
        if any("ModuleNotFoundError" in e for e in ray_log_analysis.evals_errors):
            report.recommendations.append("在 pip 依赖列表或 Ray runtime_env 中添加缺失的 Python 包")
        if any("is not supported" in e for e in ray_log_analysis.evals_errors):
            report.recommendations.append("使用包含该 eval class 的 evals 分支/commit，或更新 evals pip 包版本")
        if any("IndexError" in e or "KeyError" in e for e in ray_log_analysis.evals_errors):
            report.recommendations.append("修复评估代码中的数据索引/键错误，检查数据集格式是否匹配")
        if not report.recommendations:
            report.recommendations.append("查看 ray_log 中的 traceback 修复评估代码错误")
    if inf_server_failed and not inf_is_platform_reclaim and not ray_log_analysis.has_evals_error:
        report.recommendations.extend(
            [
                "检查推理服务节点的 GPU 资源配额和队列权限",
                "确认模型权重路径 (model_path) 可以正常访问",
                "尝试使用其他集群/队列重新提交",
            ]
        )
    if oom_is_root_cause:
        report.recommendations.extend(
            [
                "增加评估节点的内存配额",
                "减少并发运行的 exercise 数量",
            ]
        )
    elif oom_is_secondary and not ray_log_analysis.has_evals_error:
        report.recommendations.append(f"评估 {'/'.join(oom_nodes)} 节点有 OOM 记录但非根因，优先解决主要问题后观察")
    if not logs_available and not report.recommendations:
        report.recommendations.append("日志已过期，建议重新提交任务以复现问题")
    if not report.recommendations:
        report.recommendations.append("查看完整日志以定位具体错误")

    return report


def format_report(report: DiagnosisReport) -> str:
    lines = []
    lines.append("# Arena 评估任务失败诊断报告\n")

    lines.append("## 1. 概要")
    lines.append(f"**{report.root_cause}**\n")

    lines.append("## 2. 任务信息")
    lines.append(f"- 评估任务 SID: `{report.evaluation_task_sid}`")
    lines.append(f"- Arena SID: `{report.arena_sid}`")
    lines.append(f"- Job Run ID: `{report.job_run_id}`")
    lines.append(f"- Trial ID: `{report.trial_id}`")
    lines.append(f"- 状态: **{report.overall_status}**")
    lines.append(f"- 创建者: {report.creator}")
    lines.append(f"- 时间: {report.created_at} → {report.completed_at}")
    if report.model_path:
        lines.append(f"- 模型路径: `{report.model_path}`")
    lines.append("")

    lines.append("## 3. 节点状态")
    lines.append("| 节点 | 状态 | 退出码 | 诊断结论 |")
    lines.append("|------|------|--------|----------|")
    for n in report.nodes:
        exit_code_str = str(n.exit_code) if n.exit_code is not None else "-"
        lines.append(f"| {n.name} | {n.status} | {exit_code_str} | {n.conclusion} |")
    lines.append("")

    lines.append("## 4. 根因分析")
    lines.append(f"{report.root_cause}\n")

    # Show ray_log analysis if available
    rla = report.ray_log_analysis
    if rla and rla.has_evals_error:
        lines.append("## 5. 关键错误详情 (ray_log)\n")
        if rla.first_traceback:
            lines.append("### Traceback")
            lines.append("```")
            tb_lines = rla.first_traceback.splitlines()
            for tl in tb_lines[-15:]:
                lines.append(tl)
            lines.append("```\n")
        if rla.exception_manager_root_causes:
            lines.append(f"### ExceptionManager\n```\n{rla.exception_manager_root_causes}\n```\n")
        for pe in rla.exception_manager_process_exits[:3]:
            lines.append(f"```\n{pe}\n```\n")
    elif any(n.key_logs for n in report.nodes):
        lines.append("## 5. 关键日志摘录\n")
        for n in report.nodes:
            if n.key_logs:
                lines.append(f"### {n.name}")
                lines.append("```")
                for log_line in n.key_logs[:8]:
                    lines.append(log_line)
                lines.append("```\n")

    lines.append("## 6. Exercise 完成情况")
    lines.append(f"{report.exercise_summary}\n")
    if report.exercises:
        lines.append("| Exercise | 完成 | 总数 | 状态 |")
        lines.append("|----------|------|------|------|")
        for ex in sorted(report.exercises, key=lambda x: (x.status != "completed", -x.completed)):
            lines.append(f"| {ex.key} | {ex.completed} | {ex.total} | {ex.status} |")
    lines.append("")

    lines.append("## 7. 修复建议")
    for i, rec in enumerate(report.recommendations, 1):
        lines.append(f"{i}. {rec}")
    lines.append("")

    return "\n".join(lines)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Diagnose a failed Arena evaluation task")
    parser.add_argument("--url", required=True, help="Arena evaluation URL or evaluation_task_sid")
    parser.add_argument("--control-plane", default="cn-seed", help="Merlin control plane (default: cn-seed)")
    parser.add_argument("--out-dir", default="./arena_diagnosis", help="Output directory")
    parser.add_argument("--log-tail-lines", type=int, default=120, help="Number of log lines to analyze from the tail")
    args = parser.parse_args(argv)

    out_dir = Path(args.out_dir).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Diagnosing evaluation task: {args.url}", file=sys.stderr)
    report = diagnose(args.url, args.control_plane, args.log_tail_lines)

    report_md = format_report(report)
    report_path = out_dir / "diagnosis_report.md"
    report_path.write_text(report_md, encoding="utf-8")

    report_json = out_dir / "diagnosis_report.json"
    report_dict = {
        "evaluation_task_sid": report.evaluation_task_sid,
        "arena_sid": report.arena_sid,
        "job_run_id": report.job_run_id,
        "trial_id": report.trial_id,
        "overall_status": report.overall_status,
        "root_cause": report.root_cause,
        "nodes": [
            {
                "name": n.name,
                "status": n.status,
                "exit_code": n.exit_code,
                "error_info": n.error_info,
                "conclusion": n.conclusion,
                "key_logs": n.key_logs,
            }
            for n in report.nodes
        ],
        "exercise_summary": report.exercise_summary,
        "recommendations": report.recommendations,
    }
    report_json.write_text(json.dumps(report_dict, ensure_ascii=False, indent=2), encoding="utf-8")

    print(report_md)
    print(f"\nReport saved to: {report_path}", file=sys.stderr)
    print(f"JSON saved to: {report_json}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
