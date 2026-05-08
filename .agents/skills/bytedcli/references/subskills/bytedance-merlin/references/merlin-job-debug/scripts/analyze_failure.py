#!/usr/bin/env python3
import argparse
import json
import os
import re
import subprocess
import sys
import textwrap
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from collections import Counter
from typing import Any, Iterable, List, Optional, Tuple


URL_RE = re.compile(r"https?://\S+")
JOB_RUN_ID_RE = re.compile(r"/jobs/([^/?#]+)")


@dataclass(frozen=True)
class Evidence:
    kind: str
    detail: str


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _strip_ansi(s: str) -> str:
    return re.sub(r"\x1b\[[0-9;]*[a-zA-Z]", "", s)


def parse_job_id(raw: str) -> str:
    raw = raw.strip()
    m = JOB_RUN_ID_RE.search(raw)
    if m:
        return m.group(1)
    return raw


def run_cmd(argv: List[str]) -> str:
    proc = subprocess.run(argv, capture_output=True, text=True)
    if proc.returncode != 0:
        stderr = (proc.stderr or "").strip()
        stdout = (proc.stdout or "").strip()
        msg = stderr if stderr else stdout
        raise RuntimeError(f"command failed ({proc.returncode}): {' '.join(argv)}\n{msg}")
    return proc.stdout


def try_parse_json(text: str) -> Optional[Any]:
    text = text.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except Exception:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if 0 <= start < end:
        try:
            return json.loads(text[start : end + 1])
        except Exception:
            return None
    start = text.find("[")
    end = text.rfind("]")
    if 0 <= start < end:
        try:
            return json.loads(text[start : end + 1])
        except Exception:
            return None
    return None


def _iter_scalars(obj: Any) -> Iterable[Any]:
    if isinstance(obj, dict):
        for v in obj.values():
            yield from _iter_scalars(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _iter_scalars(v)
    else:
        yield obj


def _find_first(obj: Any, keys: Tuple[str, ...]) -> Optional[Any]:
    if isinstance(obj, dict):
        for k in keys:
            if k in obj and obj[k] is not None:
                return obj[k]
        for v in obj.values():
            found = _find_first(v, keys)
            if found is not None:
                return found
    elif isinstance(obj, list):
        for v in obj:
            found = _find_first(v, keys)
            if found is not None:
                return found
    return None


def infer_trial_id(get_job_run_obj: Any) -> Optional[str]:
    direct = _find_first(get_job_run_obj, ("trial_id", "trialId", "trialID"))
    if isinstance(direct, (str, int)):
        return str(direct)

    candidates: List[str] = []
    if isinstance(get_job_run_obj, dict):
        for key in ("trials", "trial_infos", "trialInfos", "trial_list", "trialList"):
            trials = get_job_run_obj.get(key)
            if isinstance(trials, list):
                for t in trials:
                    tid = _find_first(t, ("trial_id", "trialId", "trialID", "id"))
                    if isinstance(tid, (str, int)):
                        candidates.append(str(tid))
    if candidates:
        return candidates[-1]
    return None


@dataclass(frozen=True)
class RepoInfo:
    repo_url: Optional[str]
    commit_id: Optional[str]
    branch: Optional[str]


def infer_repo_info(get_job_run_obj: Any) -> RepoInfo:
    """Extract code repository URL, commit ID, and branch from get-run response."""
    repo_url = _find_first(get_job_run_obj, (
        "repo_url", "repoUrl", "git_url", "gitUrl",
        "code_source", "codeSource", "repo", "repository",
    ))
    commit_id = _find_first(get_job_run_obj, (
        "commit_id", "commitId", "git_commit", "gitCommit",
        "commit", "revision", "sha",
    ))
    branch = _find_first(get_job_run_obj, (
        "branch", "git_branch", "gitBranch", "ref",
    ))
    return RepoInfo(
        repo_url=str(repo_url) if repo_url else None,
        commit_id=str(commit_id) if commit_id else None,
        branch=str(branch) if branch else None,
    )


def infer_log_url(list_logs_obj: Any) -> Optional[str]:
    for v in _iter_scalars(list_logs_obj):
        if isinstance(v, str) and v.startswith(("http://", "https://")):
            if "log" in v or "proxy" in v:
                return v
    return None


def _collect_all_run_indexes(obj: Any) -> List[int]:
    """Recursively collect all robust_run_index values from a nested structure."""
    indexes: set[int] = set()
    if isinstance(obj, dict):
        for k in ("robust_run_index", "robustRunIndex", "run_index", "runIndex"):
            v = obj.get(k)
            if isinstance(v, int):
                indexes.add(v)
            elif isinstance(v, str) and v.isdigit():
                indexes.add(int(v))
        for v in obj.values():
            indexes.update(_collect_all_run_indexes(v))
    elif isinstance(obj, list):
        for v in obj:
            indexes.update(_collect_all_run_indexes(v))
    return sorted(indexes)


def infer_latest_run_index(list_logs_obj: Any) -> Optional[int]:
    indexes = _collect_all_run_indexes(list_logs_obj)
    return max(indexes) if indexes else None


def download_text(url: str, timeout_sec: int = 60) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "rd-skills/job-analyze-failure-post-mortem"})
    with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
        data = resp.read()
    try:
        return data.decode("utf-8", errors="replace")
    except Exception:
        return data.decode(errors="replace")


def tail_lines(text: str, max_lines: int) -> str:
    lines = text.splitlines()
    if len(lines) <= max_lines:
        return text
    return "\n".join(lines[-max_lines:])


MACHINE_FAULT_ALERT_TYPES = ("alert.karl.inspection", "event.karl.fault_ticket")


def fetch_trial_alerts(job_run_id: str, trial_id: str) -> Tuple[str, Any]:
    """Fetch trial alerts and return (raw_output, parsed_object)."""
    try:
        raw = run_cmd([
            "merlin-cli", "job", "get-trial-alerts",
            "--json", json.dumps({"job_run_id": job_run_id, "trial_id": trial_id}),
        ])
        return raw, try_parse_json(raw)
    except Exception as e:
        return f"ERROR: {e}", None


def detect_machine_fault(alerts_obj: Any) -> List[Evidence]:
    """Check alerts for machine fault signals. Returns evidence list (empty if none)."""
    if alerts_obj is None:
        return []
    evidences: List[Evidence] = []
    fault_types_found: List[str] = []

    def _scan(obj: Any) -> None:
        if isinstance(obj, dict):
            for key in ("type", "alert_type", "alertType", "event_type", "eventType", "name"):
                val = obj.get(key)
                if isinstance(val, str):
                    for ft in MACHINE_FAULT_ALERT_TYPES:
                        if ft in val and ft not in fault_types_found:
                            fault_types_found.append(ft)
            for v in obj.values():
                _scan(v)
        elif isinstance(obj, list):
            for v in obj:
                _scan(v)

    _scan(alerts_obj)
    for ft in fault_types_found:
        evidences.append(Evidence("alert", f"机器故障告警: {ft}"))
    return evidences


def classify_failure(exit_info_obj: Any, log_tail: str, machine_fault_evidences: Optional[List[Evidence]] = None) -> Tuple[str, List[Evidence]]:
    evidences: List[Evidence] = []

    if machine_fault_evidences:
        evidences.extend(machine_fault_evidences)
        return "基础设施类：机器故障（MACHINE_FAULT）", evidences

    exit_codes: List[int] = []
    for v in _iter_scalars(exit_info_obj):
        if isinstance(v, int):
            exit_codes.append(v)
        elif isinstance(v, str) and v.isdigit():
            exit_codes.append(int(v))

    log_tail_lc = log_tail.lower()

    def has_any(substrings: List[str]) -> bool:
        return any(s.lower() in log_tail_lc for s in substrings)

    if has_any(["cuda out of memory", "cublas_status_alloc_failed", "out of memory", "oom"]) or any(
        c in (137, 143) for c in exit_codes
    ):
        if has_any(["cuda out of memory", "cublas_status_alloc_failed", "torch.cuda.outofmemoryerror"]):
            evidences.append(Evidence("log", "匹配 CUDA OOM 关键词"))
        if any(c in (137, 143) for c in exit_codes):
            evidences.append(Evidence("exit_code", "出现 137/143（常见于 OOM/被驱逐/被终止）"))
        return "资源类：内存/显存不足（OOM）", evidences

    if has_any(["no space left on device", "disk quota exceeded", "enospc"]):
        evidences.append(Evidence("log", "匹配磁盘空间耗尽关键词"))
        return "资源类：磁盘空间不足", evidences

    if has_any(
        [
            "nccl timeout",
            "connection reset",
            "read timed out",
            "timeout",
            "socket timeout",
            "connection refused",
            "name or service not known",
        ]
    ):
        evidences.append(Evidence("log", "匹配网络/通信异常关键词"))
        return "基础设施类：网络/通信异常", evidences

    if has_any(["segmentation fault", "sigsegv"]) or any(c == 139 for c in exit_codes):
        if any(c == 139 for c in exit_codes):
            evidences.append(Evidence("exit_code", "出现 139（常见于段错误）"))
        if has_any(["segmentation fault", "sigsegv"]):
            evidences.append(Evidence("log", "匹配段错误关键词"))
        return "运行时崩溃：段错误/底层库崩溃", evidences

    if has_any(
        [
            "shape mismatch",
            "size mismatch",
            "mat1 and mat2 shapes cannot be multiplied",
            "expected scalar type",
            "dtype",
            "keyerror",
            "indexerror",
            "jsondecodeerror",
            "parquet",
            "crc",
        ]
    ):
        evidences.append(Evidence("log", "匹配数据/形状/类型相关关键词"))
        return "数据与 Pipeline：输入/形状/类型/解析错误", evidences

    if has_any(["nan", "inf", "overflow", "floating point exception"]):
        evidences.append(Evidence("log", "匹配数值不稳定关键词"))
        return "数值稳定性：NaN/Inf/溢出", evidences

    if has_any(["traceback", "exception", "error"]):
        evidences.append(Evidence("log", "日志末尾包含异常/错误关键词"))
        return "代码异常：需要从 traceback 精确定位", evidences

    if exit_codes:
        evidences.append(Evidence("exit_code", f"退出码候选: {sorted(set(exit_codes))[:8]}"))
    return "未知：信息不足（建议补充更完整日志或进入在线排查）", evidences


def extract_traceback_locations(log_text: str, max_items: int = 10) -> List[str]:
    matches: List[str] = []
    for m in re.finditer(r'File "([^"]+)", line (\d+)', log_text):
        matches.append(f'{m.group(1)}:{m.group(2)}')
        if len(matches) >= max_items:
            break
    if matches:
        return matches

    for m in re.finditer(r"([A-Za-z0-9_./-]+\.(?:py|cc|cu|cpp|cuh|h|hpp)):(\d+)", log_text):
        matches.append(f"{m.group(1)}:{m.group(2)}")
        if len(matches) >= max_items:
            break
    return matches


@dataclass
class RunAnalysisResult:
    run_index: int
    exit_info_raw: str
    exit_info_obj: Any
    log_url: Optional[str]
    log_tail_clean: str
    classification: str
    evidences: List[Evidence]
    locations: List[str]
    has_machine_fault: bool = False
    repo_info: Optional[RepoInfo] = None


def render_markdown(
    job_run_id: str,
    trial_id: Optional[str],
    run_index: Optional[int],
    exit_info_raw: str,
    log_url: Optional[str],
    log_tail_clean: str,
    classification: str,
    evidences: List[Evidence],
    locations: List[str],
    alerts_raw: str = "",
    repo_info: Optional[RepoInfo] = None,
) -> str:
    header = f"# Merlin 任务失败事后分析报告\n\n- 生成时间: {_now_iso()}\n- job_run_id: {job_run_id}\n"
    if trial_id is not None:
        header += f"- trial_id: {trial_id}\n"
    if run_index is not None:
        header += f"- robust_run_index: {run_index}\n"
    if log_url is not None:
        header += f"- log_url: {log_url}\n"
    if repo_info:
        if repo_info.repo_url:
            header += f"- repo_url: {repo_info.repo_url}\n"
        if repo_info.commit_id:
            header += f"- commit_id: {repo_info.commit_id}\n"
        if repo_info.branch:
            header += f"- branch: {repo_info.branch}\n"

    md = header
    md += "\n## 结论\n\n"
    md += f"- 失败类别: {classification}\n"
    if evidences:
        md += "- 关键证据:\n"
        for e in evidences[:6]:
            md += f"  - {e.kind}: {e.detail}\n"
    if locations:
        md += "- 代码定位候选:\n"
        for loc in locations[:10]:
            md += f"  - {loc}\n"

    if any(e.kind == "alert" for e in evidences):
        md += "\n## ⚠️ 机器故障告警\n\n"
        md += "检测到明确的机器故障告警信号，任务失败很可能由基础设施故障引起，非用户代码/配置问题。\n"
        md += "建议：排除故障节点后重新提交任务，或等待故障工单处理完毕。\n\n"
        md += "```text\n"
        md += (alerts_raw.strip() + "\n") if alerts_raw.strip() else "(empty)\n"
        md += "```\n"

    md += "\n## Pod 退出信息（原始输出）\n\n"
    md += "```text\n"
    md += (exit_info_raw.strip() + "\n") if exit_info_raw.strip() else "(empty)\n"
    md += "```\n"

    if locations and repo_info and repo_info.repo_url:
        md += "\n## 代码定位\n\n"
        md += f"- 仓库: `{repo_info.repo_url}`\n"
        if repo_info.commit_id:
            md += f"- Commit: `{repo_info.commit_id}`\n"
        md += "\n克隆并分析:\n\n"
        md += "```bash\n"
        md += f"git clone --depth 1 \"{repo_info.repo_url}\" /tmp/job_repo && cd /tmp/job_repo\n"
        if repo_info.commit_id:
            md += f"git fetch --depth 1 origin {repo_info.commit_id} && git checkout {repo_info.commit_id}\n"
        md += "```\n\n"
        md += "Traceback 文件位置（需映射容器路径到仓库路径）:\n\n"
        for loc in locations[:10]:
            md += f"- `{loc}`\n"

    md += "\n## 日志尾部（清洗 ANSI 后）\n\n"
    md += "```text\n"
    md += (log_tail_clean.strip() + "\n") if log_tail_clean.strip() else "(empty)\n"
    md += "```\n"
    return md


def render_multi_run_markdown(
    job_run_id: str,
    trial_id: Optional[str],
    run_results: List[RunAnalysisResult],
    alerts_raw: str = "",
    repo_info: Optional[RepoInfo] = None,
) -> str:
    md = f"# Merlin 任务失败事后分析报告（多 Run 模式）\n\n"
    md += f"- 生成时间: {_now_iso()}\n"
    md += f"- job_run_id: {job_run_id}\n"
    if trial_id is not None:
        md += f"- trial_id: {trial_id}\n"
    md += f"- 分析 run 数量: {len(run_results)}\n"
    if repo_info:
        if repo_info.repo_url:
            md += f"- repo_url: {repo_info.repo_url}\n"
        if repo_info.commit_id:
            md += f"- commit_id: {repo_info.commit_id}\n"
        if repo_info.branch:
            md += f"- branch: {repo_info.branch}\n"

    if any(r.has_machine_fault for r in run_results):
        md += "\n## ⚠️ 机器故障告警\n\n"
        md += "检测到明确的机器故障告警信号，任务失败很可能由基础设施故障引起，非用户代码/配置问题。\n"
        md += "建议：排除故障节点后重新提交任务，或等待故障工单处理完毕。\n\n"
        md += "```text\n"
        md += (alerts_raw.strip() + "\n") if alerts_raw.strip() else "(empty)\n"
        md += "```\n"

    md += "\n## 跨 Run 摘要\n\n"
    md += "| Run Index | 失败类别 | 关键证据 |\n"
    md += "|-----------|---------|--------|\n"
    for r in run_results:
        evidence_str = "; ".join(e.detail for e in r.evidences[:2]) if r.evidences else "-"
        md += f"| {r.run_index} | {r.classification} | {evidence_str} |\n"

    classifications = [r.classification for r in run_results]
    unique_classes = list(dict.fromkeys(classifications))

    md += "\n## 跨 Run 模式分析\n\n"
    if len(unique_classes) == 1:
        md += f"- **反复性失败**: 所有 {len(run_results)} 个 run 均因相同原因失败 → `{unique_classes[0]}`\n"
        md += "- Robust restart 未能解决根本问题，需要系统性修复\n"
    elif len(unique_classes) < len(run_results):
        counts = Counter(classifications)
        dominant = counts.most_common(1)[0]
        md += f"- **混合模式**: 最常见失败类型为 `{dominant[0]}`（{dominant[1]}/{len(run_results)} 次）\n"
        md += "- 其他失败类型: " + ", ".join(f"`{c}`" for c in unique_classes if c != dominant[0]) + "\n"
    else:
        md += f"- **间歇性失败**: {len(run_results)} 个 run 出现 {len(unique_classes)} 种不同失败类型\n"
        md += "- 可能与环境不稳定（网络、机器故障等）有关\n"

    for r in run_results:
        md += f"\n---\n\n## Run {r.run_index} 详细分析\n\n"
        md += f"- 失败类别: {r.classification}\n"
        if r.log_url:
            md += f"- log_url: {r.log_url}\n"
        if r.evidences:
            md += "- 关键证据:\n"
            for e in r.evidences[:6]:
                md += f"  - {e.kind}: {e.detail}\n"
        if r.locations:
            md += "- 代码定位候选:\n"
            for loc in r.locations[:10]:
                md += f"  - {loc}\n"
        md += "\n### Pod 退出信息\n\n```text\n"
        md += (r.exit_info_raw.strip() + "\n") if r.exit_info_raw.strip() else "(empty)\n"
        md += "```\n"
        md += "\n### 日志尾部\n\n```text\n"
        md += (r.log_tail_clean.strip() + "\n") if r.log_tail_clean.strip() else "(empty)\n"
        md += "```\n"

    return md


def analyze_single_run(
    job_run_id: str,
    trial_id: str,
    run_index: int,
    max_tail_lines: int,
    machine_fault_evidences: Optional[List[Evidence]] = None,
) -> RunAnalysisResult:
    """Analyze a single robust run and return structured result."""
    exit_info_raw = ""
    exit_info_obj: Any = None
    try:
        exit_info_raw = run_cmd([
            "merlin-cli", "job", "list-trial-exit-info",
            "--json", json.dumps({
                "job_run_id": job_run_id,
                "trial_id": trial_id,
                "filter": {"robust_run_index": run_index},
            }),
        ])
        exit_info_obj = try_parse_json(exit_info_raw)
    except Exception as e:
        exit_info_raw = f"ERROR: {e}"

    log_url: Optional[str] = None
    for argv in (
        ["merlin-cli", "job", "list-trial-logs",
         "--json", json.dumps({"trial_id": trial_id, "filter": {"robust_run_index": run_index}})],
        ["merlin-cli", "job", "list-trial-logs",
         "--json", json.dumps({"job_run_id": job_run_id, "trial_id": trial_id, "filter": {"robust_run_index": run_index}})],
    ):
        try:
            raw_logs = run_cmd(argv)
            obj_logs = try_parse_json(raw_logs)
            if obj_logs is not None:
                log_url = infer_log_url(obj_logs)
            if log_url is None:
                m = URL_RE.search(raw_logs)
                if m:
                    log_url = m.group(0)
            if log_url:
                break
        except Exception:
            continue

    log_text = ""
    if log_url:
        try:
            log_text = download_text(log_url)
        except Exception:
            log_text = ""

    log_tail = tail_lines(log_text, max_tail_lines) if log_text else ""
    log_tail_clean = _strip_ansi(log_tail)
    classification, evidences = classify_failure(exit_info_obj, log_tail_clean, machine_fault_evidences)
    locations = extract_traceback_locations(log_tail_clean)

    return RunAnalysisResult(
        run_index=run_index,
        exit_info_raw=exit_info_raw,
        exit_info_obj=exit_info_obj,
        log_url=log_url,
        log_tail_clean=log_tail_clean,
        classification=classification,
        evidences=evidences,
        locations=locations,
        has_machine_fault=bool(machine_fault_evidences),
    )


def _discover_all_run_indexes(job_run_id: str, trial_id: str) -> List[int]:
    """Discover all robust_run_index values for a trial by listing its logs."""
    for argv in (
        ["merlin-cli", "job", "list-trial-logs",
         "--json", json.dumps({"trial_id": trial_id})],
        ["merlin-cli", "job", "list-trial-logs",
         "--json", json.dumps({"job_run_id": job_run_id, "trial_id": trial_id})],
    ):
        try:
            raw = run_cmd(argv)
            obj = try_parse_json(raw)
            if obj is not None:
                indexes = _collect_all_run_indexes(obj)
                if indexes:
                    return indexes
        except Exception:
            continue
    return []


def _output_markdown(md: str, out_path: Optional[str]) -> None:
    if out_path:
        abs_path = os.path.abspath(out_path)
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        with open(abs_path, "w", encoding="utf-8") as f:
            f.write(md)
        print(abs_path)
    else:
        print(md)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Analyze a stopped Merlin job failure (post-mortem) using merlin-cli + logs.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(
            """\
            Examples:
              # Auto-detect: if multiple runs exist, analyze all of them
              python3 scripts/analyze_failure.py abc123 --trial-id 456

              # Analyze a specific run
              python3 scripts/analyze_failure.py abc123 --trial-id 456 --run-index 3 --out /tmp/post_mortem.md

              # Explicitly analyze all runs
              python3 scripts/analyze_failure.py abc123 --trial-id 456 --all-runs --out /tmp/post_mortem.md

              # Single run with explicit log source
              python3 scripts/analyze_failure.py abc123 --trial-id 456 --run-index 0 --log-url "https://..."
            """
        ),
    )
    parser.add_argument("job", help="job_run_id 或任务 URL")
    parser.add_argument("--trial-id", dest="trial_id", help="Trial ID（可选；缺省时尝试从 get_job_run 推断）")
    parser.add_argument("--run-index", dest="run_index", type=int,
                        help="robust_run_index — 指定时只分析该 run")
    parser.add_argument("--all-runs", dest="all_runs", action="store_true",
                        help="分析所有 robust run（逐 run 分析 + 跨 run 汇总）")
    parser.add_argument("--log-url", dest="log_url",
                        help="日志 URL（仅限单 run 模式；缺省时自动获取）")
    parser.add_argument("--log-file", dest="log_file",
                        help="本地日志文件路径（仅限单 run 模式；优先于 --log-url）")
    parser.add_argument("--max-tail-lines", dest="max_tail_lines", type=int, default=400,
                        help="读取日志尾部的最大行数")
    parser.add_argument("--out", dest="out", help="输出 Markdown 文件路径（可选）")
    args = parser.parse_args()

    job_run_id = parse_job_id(args.job)

    try:
        run_cmd(["merlin-cli", "--help"])
    except Exception as e:
        print(f"merlin-cli 不可用：{e}", file=sys.stderr)
        return 2

    trial_id = args.trial_id
    repo_info: Optional[RepoInfo] = None
    job_run_obj: Any = None
    try:
        raw = run_cmd(["merlin-cli", "job", "get-run",
                       "--json", json.dumps({"job_run_id": job_run_id})])
        job_run_obj = try_parse_json(raw)
    except Exception:
        job_run_obj = None

    if job_run_obj is not None:
        if not trial_id:
            trial_id = infer_trial_id(job_run_obj)
        repo_info = infer_repo_info(job_run_obj)
        if repo_info.repo_url or repo_info.commit_id:
            print(f"代码仓库: repo={repo_info.repo_url}, commit={repo_info.commit_id}, "
                  f"branch={repo_info.branch}", file=sys.stderr)

    if not trial_id:
        print("trial_id 未提供且无法自动推断；请传入 --trial-id", file=sys.stderr)
        return 2

    if args.run_index is not None and args.all_runs:
        print("--run-index 和 --all-runs 不能同时使用", file=sys.stderr)
        return 2

    # --- Determine analysis scope ---
    if args.run_index is not None:
        run_indexes_to_analyze = [args.run_index]
        multi_run_mode = False
    elif args.all_runs:
        run_indexes_to_analyze = _discover_all_run_indexes(job_run_id, trial_id)
        if not run_indexes_to_analyze:
            run_indexes_to_analyze = [0]
        multi_run_mode = len(run_indexes_to_analyze) > 1
    else:
        all_indexes = _discover_all_run_indexes(job_run_id, trial_id)
        if len(all_indexes) > 1:
            run_indexes_to_analyze = all_indexes
            multi_run_mode = True
            print(f"检测到 {len(all_indexes)} 个 robust run（index: {all_indexes}），将逐 run 分析",
                  file=sys.stderr)
        elif len(all_indexes) == 1:
            run_indexes_to_analyze = all_indexes
            multi_run_mode = False
        else:
            run_indexes_to_analyze = [0]
            multi_run_mode = False

    # --- Fetch trial alerts (machine fault detection) ---
    print("检查机器故障告警 ...", file=sys.stderr)
    alerts_raw, alerts_obj = fetch_trial_alerts(job_run_id, trial_id)
    mf_evidences = detect_machine_fault(alerts_obj)
    if mf_evidences:
        print(f"⚠️  检测到机器故障告警: {[e.detail for e in mf_evidences]}", file=sys.stderr)

    # --- Single run with explicit log source (--log-file / --log-url) ---
    if not multi_run_mode and (args.log_file or args.log_url):
        run_index = run_indexes_to_analyze[0]

        exit_info_raw = ""
        exit_info_obj: Any = None
        try:
            exit_info_raw = run_cmd([
                "merlin-cli", "job", "list-trial-exit-info",
                "--json", json.dumps({
                    "job_run_id": job_run_id, "trial_id": trial_id,
                    "filter": {"robust_run_index": run_index},
                }),
            ])
            exit_info_obj = try_parse_json(exit_info_raw)
        except Exception as e:
            exit_info_raw = f"ERROR: {e}"

        log_text = ""
        if args.log_file:
            try:
                with open(args.log_file, "r", encoding="utf-8", errors="replace") as f:
                    log_text = f.read()
            except Exception as e:
                print(f"读取日志文件失败：{e}", file=sys.stderr)
                return 2
        elif args.log_url:
            try:
                log_text = download_text(args.log_url)
            except Exception as e:
                print(f"下载日志失败：{e}", file=sys.stderr)
                log_text = ""

        log_tail = tail_lines(log_text, args.max_tail_lines) if log_text else ""
        log_tail_clean = _strip_ansi(log_tail)
        classification, evidences = classify_failure(
            exit_info_obj, log_tail_clean, mf_evidences or None)
        locations = extract_traceback_locations(log_tail_clean)

        md = render_markdown(
            job_run_id=job_run_id, trial_id=trial_id, run_index=run_index,
            exit_info_raw=exit_info_raw, log_url=args.log_url,
            log_tail_clean=log_tail_clean, classification=classification,
            evidences=evidences, locations=locations,
            alerts_raw=alerts_raw, repo_info=repo_info,
        )
        _output_markdown(md, args.out)
        return 0

    # --- Analyze run(s) via merlin-cli ---
    run_results: List[RunAnalysisResult] = []
    for idx in run_indexes_to_analyze:
        print(f"分析 robust_run_index={idx} ...", file=sys.stderr)
        result = analyze_single_run(
            job_run_id, trial_id, idx, args.max_tail_lines,
            machine_fault_evidences=mf_evidences or None,
        )
        result.repo_info = repo_info
        run_results.append(result)

    if multi_run_mode:
        md = render_multi_run_markdown(
            job_run_id=job_run_id, trial_id=trial_id, run_results=run_results,
            alerts_raw=alerts_raw, repo_info=repo_info,
        )
    else:
        r = run_results[0]
        md = render_markdown(
            job_run_id=job_run_id, trial_id=trial_id, run_index=r.run_index,
            exit_info_raw=r.exit_info_raw, log_url=r.log_url,
            log_tail_clean=r.log_tail_clean, classification=r.classification,
            evidences=r.evidences, locations=r.locations,
            alerts_raw=alerts_raw, repo_info=repo_info,
        )

    _output_markdown(md, args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
