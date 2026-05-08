#!/usr/bin/env python3
"""Compare two Arena evaluation tasks end-to-end.

Modes:
  1) --sid-a / --sid-b  : Pull arena evaluation data via merlin-cli and compare
  2) --config-a / --config-b : Compare two local YAML configs only

Produces a markdown diff report covering:
  - Task metadata (branch, commit, model, etc.)
  - conf.env differences
  - conf.model.extra_json differences
  - Entrypoint YAML config differences
  - Exercise score differences
  - (with --fetch-cases) Sample-level score & predict diffs
"""

import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import parse_qs, urlparse

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore[assignment]


def _run_merlin_cli(args: list[str]) -> Dict[str, Any]:
    cmd = ["merlin-cli", *args]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        raise RuntimeError(f"merlin-cli failed: {' '.join(cmd)}\n{p.stderr.strip()}")
    return json.loads(p.stdout.strip())


def _extract_sid(url_or_sid: str) -> str:
    s = url_or_sid.strip()
    if re.fullmatch(r"[a-z0-9]{10,64}", s):
        return s
    qs = parse_qs(urlparse(s).query or "")
    sid = (qs.get("evaluation_task_sid") or [""])[0].strip()
    if not sid:
        raise RuntimeError(f"Cannot extract evaluation_task_sid from: {s}")
    return sid


def _normalize_for_compare(val: Any) -> Any:
    """Normalize lists of dicts by sorting them so order doesn't cause false diffs."""
    if isinstance(val, list):
        try:
            return sorted(val, key=lambda x: json.dumps(x, sort_keys=True, ensure_ascii=False))
        except TypeError:
            return val
    return val


def _flatten(d: Any, prefix: str = "") -> Dict[str, Any]:
    items: Dict[str, Any] = {}
    if isinstance(d, dict):
        for k, v in d.items():
            key = f"{prefix}.{k}" if prefix else str(k)
            if isinstance(v, dict):
                items.update(_flatten(v, key))
            else:
                items[key] = _normalize_for_compare(v)
    return items


def _truncate(val: Any, max_len: int = 120) -> str:
    s = str(val)
    return s if len(s) <= max_len else s[: max_len - 3] + "..."


def _load_yaml(path: str) -> Dict[str, Any]:
    if yaml is None:
        raise RuntimeError("PyYAML not installed. Run: pip install pyyaml")
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"File not found: {path}")
    with p.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError(f"Expected YAML mapping, got {type(data).__name__}")
    return data


TOS_URL_PREFIXES = [
    "https://tosv.byted.org/obj/",
    "https://tosv-useastbd.byted.org/obj/",
    "https://tosv-va.tiktok-row.org/obj/",
    "https://tosv-sg.tiktok-row.org/obj/",
]


def _download_tos(tos_path: str, out_path: str) -> bool:
    for prefix in TOS_URL_PREFIXES:
        url = tos_path.replace("tos://", prefix)
        r = subprocess.run(["wget", "-q", "-O", out_path, url], capture_output=True)
        if r.returncode == 0:
            return True
    return False


# ---------------------------------------------------------------------------
# Section: Task metadata comparison
# ---------------------------------------------------------------------------

METADATA_FIELDS = [
    ("branch", "代码分支"),
    ("commit_sha", "代码 Commit"),
    ("titan_model_sid", "模型 SID"),
    ("name", "任务名称"),
    ("model_path", "模型路径"),
    ("region", "地域"),
    ("gitlab_project_id", "GitLab 项目 ID"),
    ("status", "状态"),
]


def _compare_metadata(ae_a: Dict, ae_b: Dict) -> List[Dict[str, str]]:
    diffs: List[Dict[str, str]] = []
    for field, label in METADATA_FIELDS:
        va = ae_a.get(field)
        vb = ae_b.get(field)
        if va != vb:
            diffs.append({"field": label, "key": field, "a": _truncate(va), "b": _truncate(vb)})
    return diffs


# ---------------------------------------------------------------------------
# Section: conf.env comparison
# ---------------------------------------------------------------------------

def _compare_env(env_a: Dict, env_b: Dict) -> List[Dict[str, str]]:
    diffs: List[Dict[str, str]] = []
    all_keys = sorted(set(list(env_a.keys()) + list(env_b.keys())))
    for k in all_keys:
        va = env_a.get(k)
        vb = env_b.get(k)
        if va != vb:
            diffs.append({
                "key": k,
                "a": repr(va) if va is not None else "(missing)",
                "b": repr(vb) if vb is not None else "(missing)",
            })
    return diffs


# ---------------------------------------------------------------------------
# Section: conf.model.extra_json comparison
# ---------------------------------------------------------------------------

def _parse_extra_json(model_conf: Dict) -> Dict:
    raw = model_conf.get("extra_json", "{}")
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:
            return {}
    return raw if isinstance(raw, dict) else {}


def _compare_extra_json(extra_a: Dict, extra_b: Dict) -> List[Dict[str, str]]:
    flat_a = _flatten(extra_a)
    flat_b = _flatten(extra_b)
    diffs: List[Dict[str, str]] = []
    for k in sorted(set(list(flat_a.keys()) + list(flat_b.keys()))):
        va = flat_a.get(k)
        vb = flat_b.get(k)
        if va != vb:
            diffs.append({
                "key": k,
                "a": _truncate(va) if va is not None else "(missing)",
                "b": _truncate(vb) if vb is not None else "(missing)",
            })
    return diffs


# ---------------------------------------------------------------------------
# Section: Entrypoint YAML comparison
# ---------------------------------------------------------------------------

SKIP_YAML_PREFIXES = [
    "output.evaluation_sid",
    "deployment.psm",
]


def _compare_yaml_configs(cfg_a: Dict, cfg_b: Dict) -> List[Dict[str, str]]:
    flat_a = _flatten(cfg_a)
    flat_b = _flatten(cfg_b)
    diffs: List[Dict[str, str]] = []
    for k in sorted(set(list(flat_a.keys()) + list(flat_b.keys()))):
        if any(k.startswith(pfx) for pfx in SKIP_YAML_PREFIXES):
            continue
        va = flat_a.get(k)
        vb = flat_b.get(k)
        if va != vb:
            diffs.append({
                "key": k,
                "a": _truncate(va) if va is not None else "(missing)",
                "b": _truncate(vb) if vb is not None else "(missing)",
            })
    return diffs


# ---------------------------------------------------------------------------
# Section: Exercise score comparison
# ---------------------------------------------------------------------------

def _extract_exercises(ae: Dict) -> Dict[str, Dict]:
    detail = ae.get("progress", {}).get("detail", {})
    result = {}
    for key, val in detail.items():
        if not isinstance(val, dict):
            continue
        score = val.get("score", {})
        result[key] = {
            "exercise_sid": val.get("exercise_sid"),
            "exercise_version_sid": val.get("exercise_version_sid"),
            "completed": val.get("completed"),
            "avg_score": score.get("avg_score") if isinstance(score, dict) else None,
            "error_rate": score.get("error_rate") if isinstance(score, dict) else None,
            "status": val.get("status"),
        }
    return result


def _compare_exercises(ex_a: Dict, ex_b: Dict) -> Tuple[List[str], List[Dict]]:
    common = sorted(set(ex_a.keys()) & set(ex_b.keys()))
    only_a = sorted(set(ex_a.keys()) - set(ex_b.keys()))
    only_b = sorted(set(ex_b.keys()) - set(ex_a.keys()))

    diffs: List[Dict] = []
    for key in common:
        sa = ex_a[key].get("avg_score")
        sb = ex_b[key].get("avg_score")
        diff = None
        if sa is not None and sb is not None:
            diff = float(sa) - float(sb)
        diffs.append({
            "exercise": key,
            "exercise_version_sid": ex_a[key].get("exercise_version_sid"),
            "score_a": sa,
            "score_b": sb,
            "diff": diff,
        })
    diffs.sort(key=lambda d: abs(d["diff"]) if d["diff"] is not None else 0, reverse=True)

    notes: List[str] = []
    if only_a:
        notes.append(f"仅 Task A 有的 exercise: {', '.join(only_a)}")
    if only_b:
        notes.append(f"仅 Task B 有的 exercise: {', '.join(only_b)}")
    return notes, diffs


# ---------------------------------------------------------------------------
# Section: conf-level other fields
# ---------------------------------------------------------------------------

CONF_SCALAR_FIELDS = [
    ("config_type", "配置类型"),
    ("inference_engine", "推理引擎"),
    ("is_cot", "CoT"),
    ("is_greedy", "Greedy"),
    ("param_mode", "参数模式"),
    ("system_prompt_overwrite", "覆盖 System Prompt"),
]


def _compare_conf_scalars(conf_a: Dict, conf_b: Dict) -> List[Dict[str, str]]:
    diffs: List[Dict[str, str]] = []
    for field, label in CONF_SCALAR_FIELDS:
        va = conf_a.get(field)
        vb = conf_b.get(field)
        if va != vb:
            diffs.append({"field": label, "key": field, "a": str(va), "b": str(vb)})
    return diffs


# ---------------------------------------------------------------------------
# Section: Case-level (sample) comparison
# ---------------------------------------------------------------------------

def _fetch_cases(evaluation_instance_sid: str, exercise_version_sid: str,
                 limit: int = 50) -> List[Dict]:
    """Fetch case list via merlin-cli arena list-case."""
    cmd = [
        "merlin-cli", "arena", "list-case",
        "--evaluation_instance_sid", evaluation_instance_sid,
        "--exercise_version_sid", exercise_version_sid,
        "--limit", str(limit),
    ]
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if p.returncode != 0:
        print(f"  [WARN] list-case failed: {p.stderr.strip()}", file=sys.stderr)
        return []
    try:
        data = json.loads(p.stdout.strip())
    except json.JSONDecodeError:
        print(f"  [WARN] list-case returned non-JSON output", file=sys.stderr)
        return []
    return data.get("case", [])


def _parse_case_payloads(cases: List[Dict]) -> Dict[str, Dict]:
    """Parse case list into {uuid: payload_dict}."""
    result: Dict[str, Dict] = {}
    for c in cases:
        raw = c.get("payload", "{}")
        payload = json.loads(raw) if isinstance(raw, str) else (raw or {})
        uuid = payload.get("__internal_uuid__", "")
        if uuid:
            result[uuid] = payload
    return result


def _has_thinking_content(raw_predict: str) -> bool:
    """Check whether predict_before_postprocess contains non-empty thinking."""
    if "<think" not in raw_predict:
        return False
    parts = raw_predict.split("</think", 1)
    if not parts:
        return False
    inner = parts[0].split(">", 1)
    return len(inner) > 1 and len(inner[1].strip()) > 10


def _check_prompt_pattern_diff(pa: Dict[str, Dict], pb: Dict[str, Dict],
                               common_uuids: List[str]) -> Optional[str]:
    """Check if model_input_prompt_0 patterns differ between tasks."""
    sample_uuid = common_uuids[0] if common_uuids else None
    if not sample_uuid:
        return None
    prompt_a = pa[sample_uuid].get("model_input_prompt_0", "")
    prompt_b = pb[sample_uuid].get("model_input_prompt_0", "")
    if not prompt_a and not prompt_b:
        return None
    if not prompt_a or not prompt_b:
        return "仅一侧有 model_input_prompt_0"

    special_tokens = ["<seed:tool_call>", "</seed:tool_call>", "<think>", "</think>",
                      "<|im_start|>", "<|im_end|>", "[INST]", "[/INST]"]
    diff_tokens = []
    for tok in special_tokens:
        in_a = tok in prompt_a
        in_b = tok in prompt_b
        if in_a != in_b:
            diff_tokens.append(f"{tok}({'A' if in_a else 'B'} only)")

    if diff_tokens:
        return f"特殊 token 差异: {', '.join(diff_tokens)}"
    if len(prompt_a) > 0 and len(prompt_b) > 0 and abs(len(prompt_a) - len(prompt_b)) / max(len(prompt_a), len(prompt_b)) > 0.1:
        return f"prompt 长度差异显著 (A={len(prompt_a)}, B={len(prompt_b)})"
    return None


def _compare_cases(
    sid_a: str, sid_b: str, exercise_version_sid: str,
    exercise_name: str, limit: int, out: Path,
) -> Optional[Dict]:
    """Fetch and compare case-level data for one exercise. Returns summary dict."""
    print(f"  拉取 cases: {exercise_name} ({exercise_version_sid}) ...")
    cases_a = _fetch_cases(sid_a, exercise_version_sid, limit)
    cases_b = _fetch_cases(sid_b, exercise_version_sid, limit)
    if not cases_a or not cases_b:
        print(f"  [SKIP] 无法拉取 case 数据 (A={len(cases_a)}, B={len(cases_b)})")
        return None

    pa = _parse_case_payloads(cases_a)
    pb = _parse_case_payloads(cases_b)
    common_uuids = sorted(set(pa.keys()) & set(pb.keys()))
    if not common_uuids:
        print(f"  [SKIP] 无共同 UUID (A={len(pa)}, B={len(pb)})")
        return None

    safe_name = re.sub(r"[^\w]", "_", exercise_name)
    (out / f"cases_a_{safe_name}.json").write_text(
        json.dumps(cases_a, ensure_ascii=False, indent=2)[:50_000_000]
    )
    (out / f"cases_b_{safe_name}.json").write_text(
        json.dumps(cases_b, ensure_ascii=False, indent=2)[:50_000_000]
    )

    a_better = 0
    b_better = 0
    diff_samples: List[Dict] = []

    for uuid in common_uuids:
        sa = float(pa[uuid].get("score") or 0)
        sb = float(pb[uuid].get("score") or 0)
        if abs(sa - sb) < 1e-9:
            continue
        if sa > sb:
            a_better += 1
        else:
            b_better += 1

        pred_raw_a = pa[uuid].get("predict_before_postprocess_0", "")
        pred_raw_b = pb[uuid].get("predict_before_postprocess_0", "")
        diff_samples.append({
            "uuid": uuid,
            "score_a": sa,
            "score_b": sb,
            "predict_a": _truncate(pa[uuid].get("predict_0", ""), 200),
            "predict_b": _truncate(pb[uuid].get("predict_0", ""), 200),
            "has_thinking_a": _has_thinking_content(pred_raw_a),
            "has_thinking_b": _has_thinking_content(pred_raw_b),
        })

    diff_samples.sort(key=lambda d: abs(d["score_a"] - d["score_b"]), reverse=True)

    score_pairs = []
    for uuid in common_uuids:
        sa = float(pa[uuid].get("score") or 0)
        sb = float(pb[uuid].get("score") or 0)
        score_pairs.append((sa, sb))

    prompt_pattern_diff = _check_prompt_pattern_diff(pa, pb, common_uuids)

    return {
        "exercise": exercise_name,
        "exercise_version_sid": exercise_version_sid,
        "common_count": len(common_uuids),
        "diff_count": len(diff_samples),
        "a_better": a_better,
        "b_better": b_better,
        "score_pair_distribution": Counter(score_pairs).most_common(),
        "top_diff_samples": diff_samples[:5],
        "prompt_pattern_diff": prompt_pattern_diff,
    }


def _print_score_distribution(dist: List) -> None:
    """Print a compact score pair distribution."""
    if not dist:
        return
    print(f"\n  得分分布 (score_A, score_B) → 样本数:")
    for pair, count in dist[:8]:
        sa, sb = pair
        marker = ""
        if abs(sa - sb) > 1e-9:
            marker = " ←" if sa > sb else " →"
        print(f"    ({sa:.2f}, {sb:.2f}) × {count}{marker}")
    if len(dist) > 8:
        print(f"    ... 及其他 {len(dist) - 8} 种组合")


def _print_case_report(summaries: List[Dict]) -> None:
    """Print sample-level diff report for all exercises."""
    print("\n## 样本级 Diff 分析\n")
    if not summaries:
        print("未能拉取到 case 数据，跳过样本级分析。\n")
        return

    for s in summaries:
        print(f"### {s['exercise']}\n")
        print(f"- 共同样本: {s['common_count']}, 得分不同: {s['diff_count']}"
              f" (A 更高: {s['a_better']}, B 更高: {s['b_better']})")

        top = s["top_diff_samples"]
        if top:
            think_b_wins = sum(
                1 for d in top
                if d["has_thinking_b"] and not d["has_thinking_a"] and d["score_b"] > d["score_a"]
            )
            think_a_wins = sum(
                1 for d in top
                if d["has_thinking_a"] and not d["has_thinking_b"] and d["score_a"] > d["score_b"]
            )
            if think_b_wins or think_a_wins:
                print(f"- Thinking pattern (top-5 分差样本): B 有 thinking 且 B 赢 {think_b_wins},"
                      f" A 有 thinking 且 A 赢 {think_a_wins}")

        prompt_diff = s.get("prompt_pattern_diff")
        if prompt_diff:
            print(f"- Prompt 拼接差异: {prompt_diff}")

        _print_score_distribution(s.get("score_pair_distribution", []))

        print(f"\n| UUID (前 12 位) | score A | score B | diff | thinking A | thinking B |")
        print(f"|-----------------|---------|---------|------|------------|------------|")
        for d in top:
            diff_val = d["score_a"] - d["score_b"]
            print(f"| {d['uuid'][:12]}… "
                  f"| {d['score_a']:.4f} | {d['score_b']:.4f} | {diff_val:+.4f} "
                  f"| {'✓' if d['has_thinking_a'] else '✗'} "
                  f"| {'✓' if d['has_thinking_b'] else '✗'} |")

        if top:
            print(f"\n**分差最大样本 predict 对比** (`{top[0]['uuid'][:12]}…`):\n")
            print(f"- Predict A: {top[0]['predict_a']}")
            print(f"- Predict B: {top[0]['predict_b']}")
        print()


# ---------------------------------------------------------------------------
# Root cause analysis
# ---------------------------------------------------------------------------

ROOT_CAUSE_PATTERNS: List[Tuple[str, str, str]] = [
    ("env", "THINKING_EFFORT",
     "THINKING_EFFORT 不同 → 开启 thinking 通常提升推理类得分，但可能在身份识别等场景引入幻觉"),
    ("env", "THINK_START_TOKEN",
     "THINK_START_TOKEN 不同 → 思考标记不一致可能导致 parsing 逻辑差异"),
    ("env", "THINK_END_TOKEN",
     "THINK_END_TOKEN 不同 → 思考标记不一致可能导致 parsing 逻辑差异"),
    ("env", "AGENT_MESSAGE_BEGIN_TOKEN",
     "AGENT_MESSAGE_BEGIN_TOKEN 不同 → 工具调用 token 差异影响 FC parsing"),
    ("env", "DOUBAO_FC_SDK_PARSER_TYPE",
     "FC parser 类型不同 → 影响工具调用解析逻辑"),
    ("metadata", "commit_sha",
     "代码 commit 不同 → 代码变更可能修改 prompt 拼接、后处理或评分逻辑"),
    ("metadata", "titan_model_sid",
     "模型 SID 不同 → 不同模型能力差异直接影响得分"),
    ("yaml", "model.extra_config.data.use_chatml",
     "use_chatml 不同 → prompt 拼接格式不一致"),
    ("yaml", "model.extra_config.data.think_mode",
     "think_mode 不同 → thinking 模式差异"),
    ("yaml", "model.extra_config.truncation_override_config",
     "截断配置不同 → 长文本截断策略差异可能导致信息丢失"),
    ("yaml", "model.extra_config.model.network.max_position_embeddings",
     "max_position_embeddings 不同 → 上下文长度限制不一致"),
    ("yaml", "execution.temperature",
     "temperature 不同 → 采样温度影响生成多样性"),
    ("yaml", "execution.top_p",
     "top_p 不同 → 采样参数影响生成策略"),
    ("yaml", "execution.system_prompt_override",
     "system_prompt_override 不同 → 是否覆盖原始 system prompt"),
    ("conf", "is_cot",
     "CoT 配置不同 → Chain-of-Thought 开关直接影响推理深度"),
    ("conf", "is_greedy",
     "Greedy 配置不同 → 贪心采样 vs 随机采样"),
]


def _generate_root_cause_hints(
    all_diffs: Dict[str, List[Dict[str, str]]],
    case_summaries: List[Dict],
) -> List[str]:
    hints: List[str] = []

    diff_keys_by_section: Dict[str, set] = {}
    for section, diffs in all_diffs.items():
        keys = set()
        for d in diffs:
            keys.add(d.get("key", ""))
        diff_keys_by_section[section] = keys

    for section, key_pattern, message in ROOT_CAUSE_PATTERNS:
        section_keys = diff_keys_by_section.get(section, set())
        if any(key_pattern in k for k in section_keys):
            hints.append(message)

    if case_summaries:
        has_thinking_pattern = any(
            any(d.get("has_thinking_a") != d.get("has_thinking_b")
                for d in s.get("top_diff_samples", []))
            for s in case_summaries
        )
        if has_thinking_pattern and not any("THINKING_EFFORT" in h for h in hints):
            hints.append("样本级分析显示 thinking pattern 不一致 → 模型在一侧启用了深度思考")

        prompt_diffs = [s.get("prompt_pattern_diff") for s in case_summaries if s.get("prompt_pattern_diff")]
        if prompt_diffs:
            hints.append(f"Prompt 拼接存在差异 → {prompt_diffs[0]}")

    total_diffs = sum(len(d) for d in all_diffs.values())
    if total_diffs == 0 and not hints:
        hints.append("未发现配置差异 → 分数波动可能由非确定性采样（temperature>0）导致")

    return hints


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

def _print_section(title: str, diffs: List[Dict[str, str]], col_key: str = "key",
                   col_a: str = "Task A", col_b: str = "Task B"):
    print(f"\n## {title}\n")
    if not diffs:
        print("无差异。\n")
        return
    print(f"| 配置项 | {col_a} | {col_b} |")
    print("|--------|--------|--------|")
    for d in diffs:
        k = d.get("field", d.get(col_key, ""))
        print(f"| {k} | {d['a']} | {d['b']} |")
    print()


def _print_exercise_table(notes: List[str], diffs: List[Dict]):
    print("\n## Exercise 得分对比（按分差绝对值降序）\n")
    if notes:
        for n in notes:
            print(f"> {n}")
        print()
    if not diffs:
        print("无重合 exercise。\n")
        return
    print("| Exercise | exercise_version_sid | avg_score A | avg_score B | diff (A-B) |")
    print("|----------|---------------------|-------------|-------------|------------|")
    for d in diffs:
        sa = f"{d['score_a']:.6f}" if d["score_a"] is not None else "-"
        sb = f"{d['score_b']:.6f}" if d["score_b"] is not None else "-"
        diff = f"{d['diff']:+.6f}" if d["diff"] is not None else "-"
        print(f"| {d['exercise']} | {d['exercise_version_sid']} | {sa} | {sb} | {diff} |")
    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run_full_compare(sid_a: str, sid_b: str, out_dir: str,
                     fetch_cases: bool = False, top_n: int = 5,
                     cases_limit: int = 50) -> int:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    print(f"拉取 Task A ({sid_a}) ...")
    raw_a = _run_merlin_cli(["arena", "get-evaluation", "--json", json.dumps({"sid": sid_a})])
    print(f"拉取 Task B ({sid_b}) ...")
    raw_b = _run_merlin_cli(["arena", "get-evaluation", "--json", json.dumps({"sid": sid_b})])

    ae_a = raw_a.get("arena_evaluation", raw_a.get("evaluation", raw_a))
    ae_b = raw_b.get("arena_evaluation", raw_b.get("evaluation", raw_b))

    (out / "task_a.raw.json").write_text(json.dumps(raw_a, ensure_ascii=False, indent=2))
    (out / "task_b.raw.json").write_text(json.dumps(raw_b, ensure_ascii=False, indent=2))

    conf_a = ae_a.get("conf", {})
    conf_b = ae_b.get("conf", {})

    print("\n# Arena 任务 Diff 报告\n")
    print(f"- Task A sid: `{sid_a}`")
    print(f"- Task B sid: `{sid_b}`")

    # 1. Metadata
    meta_diffs = _compare_metadata(ae_a, ae_b)
    _print_section("任务元数据 Diff", meta_diffs)

    # 2. conf scalars
    conf_scalar_diffs = _compare_conf_scalars(conf_a, conf_b)
    _print_section("conf 配置项 Diff", conf_scalar_diffs)

    # 3. conf.env
    env_diffs = _compare_env(conf_a.get("env", {}), conf_b.get("env", {}))
    _print_section("环境变量 (conf.env) Diff", env_diffs)

    # 4. conf.model.extra_json
    extra_a = _parse_extra_json(conf_a.get("model", {}))
    extra_b = _parse_extra_json(conf_b.get("model", {}))
    extra_diffs = _compare_extra_json(extra_a, extra_b)
    _print_section("模型额外配置 (extra_json) Diff", extra_diffs)

    # 5. Entrypoint YAML
    tos_a = ae_a.get("entrypoint_file_yaml_tos_path", "")
    tos_b = ae_b.get("entrypoint_file_yaml_tos_path", "")
    yaml_a_path = str(out / "entrypoint_a.yaml")
    yaml_b_path = str(out / "entrypoint_b.yaml")
    yaml_diffs: List[Dict[str, str]] = []
    if tos_a and tos_b and yaml is not None:
        ok_a = _download_tos(tos_a, yaml_a_path)
        ok_b = _download_tos(tos_b, yaml_b_path)
        if ok_a and ok_b:
            cfg_a = _load_yaml(yaml_a_path)
            cfg_b = _load_yaml(yaml_b_path)
            yaml_diffs = _compare_yaml_configs(cfg_a, cfg_b)
            _print_section("入口 YAML 配置 Diff", yaml_diffs)
        else:
            print("\n## 入口 YAML 配置 Diff\n")
            print(f"下载失败: A={'OK' if ok_a else 'FAIL'}, B={'OK' if ok_b else 'FAIL'}\n")
    elif yaml is None:
        print("\n## 入口 YAML 配置 Diff\n\nPyYAML 未安装，跳过 YAML 对比。\n")

    # 6. Collection overlap
    coll_a = conf_a.get("arena_collections", [])
    coll_b = conf_b.get("arena_collections", [])
    coll_sids_a = {(c.get("collection_sid"), c.get("collection_version_sid")) for c in coll_a}
    coll_sids_b = {(c.get("collection_sid"), c.get("collection_version_sid")) for c in coll_b}
    print("\n## Collection 覆盖\n")
    if coll_sids_a == coll_sids_b:
        print("两个任务使用完全相同的 Collection。\n")
        for cs, cv in coll_sids_a:
            print(f"- collection_sid: `{cs}`, version_sid: `{cv}`")
    else:
        common = coll_sids_a & coll_sids_b
        only_a_c = coll_sids_a - coll_sids_b
        only_b_c = coll_sids_b - coll_sids_a
        if common:
            print(f"重合 Collection: {len(common)}\n")
        if only_a_c:
            print(f"仅 Task A: {only_a_c}\n")
        if only_b_c:
            print(f"仅 Task B: {only_b_c}\n")
    print()

    # 7. Exercise scores
    ex_a = _extract_exercises(ae_a)
    ex_b = _extract_exercises(ae_b)
    notes, score_diffs = _compare_exercises(ex_a, ex_b)
    _print_exercise_table(notes, score_diffs)

    # 8. Case-level diff (Phase 3)
    case_summaries: List[Dict] = []
    if fetch_cases:
        exercises_with_diff = [
            d for d in score_diffs
            if d["diff"] is not None and abs(d["diff"]) > 1e-9
        ][:top_n]
        if exercises_with_diff:
            print(f"\n拉取分差 Top-{top_n} exercise 的 case 明细 ...\n")
            for ex in exercises_with_diff:
                summary = _compare_cases(
                    sid_a, sid_b,
                    ex["exercise_version_sid"],
                    ex["exercise"],
                    cases_limit, out,
                )
                if summary:
                    case_summaries.append(summary)
        _print_case_report(case_summaries)

    # Summary
    print(f"\n## 汇总\n")
    print(f"- 元数据差异: {len(meta_diffs)}")
    print(f"- conf 配置差异: {len(conf_scalar_diffs)}")
    print(f"- 环境变量差异: {len(env_diffs)}")
    print(f"- extra_json 差异: {len(extra_diffs)}")
    print(f"- YAML 配置差异: {len(yaml_diffs)}")
    print(f"- 重合 exercise: {len(score_diffs)}, 有分差的: "
          f"{sum(1 for d in score_diffs if d['diff'] and abs(d['diff']) > 1e-9)}")
    if case_summaries:
        total_diff_cases = sum(s["diff_count"] for s in case_summaries)
        print(f"- 样本级分析: {len(case_summaries)} 个 exercise, "
              f"共 {total_diff_cases} 个样本得分不同")

    # Auto root-cause hints
    all_diffs = {
        "metadata": meta_diffs,
        "conf": conf_scalar_diffs,
        "env": env_diffs,
        "extra_json": extra_diffs,
        "yaml": yaml_diffs,
    }
    hints = _generate_root_cause_hints(all_diffs, case_summaries)
    if hints:
        print("\n## 可能根因提示\n")
        for i, hint in enumerate(hints, 1):
            print(f"{i}. {hint}")
    print()

    report = {
        "metadata_diffs": meta_diffs,
        "conf_scalar_diffs": conf_scalar_diffs,
        "env_diffs": env_diffs,
        "extra_json_diffs": extra_diffs,
        "yaml_diffs": yaml_diffs,
        "exercise_score_diffs": score_diffs,
        "case_summaries": case_summaries,
        "root_cause_hints": hints,
    }
    (out / "diff_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"详细 JSON 报告已保存到: {out / 'diff_report.json'}")
    return 0


def run_yaml_compare(config_a: str, config_b: str, json_output: Optional[str]) -> int:
    if yaml is None:
        print("PyYAML not installed. Run: pip install pyyaml", file=sys.stderr)
        return 1
    cfg_a = _load_yaml(config_a)
    cfg_b = _load_yaml(config_b)
    diffs = _compare_yaml_configs(cfg_a, cfg_b)
    if not diffs:
        print("两个 YAML 配置完全一致，无差异。")
        return 0
    _print_section("YAML 配置 Diff", diffs)
    if json_output:
        Path(json_output).write_text(json.dumps(diffs, ensure_ascii=False, indent=2))
        print(f"JSON diff saved to: {json_output}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Compare two Arena evaluation tasks")
    g1 = parser.add_argument_group("Full comparison (via merlin-cli)")
    g1.add_argument("--sid-a", help="Task A: evaluation_task_sid or Arena URL")
    g1.add_argument("--sid-b", help="Task B: evaluation_task_sid or Arena URL")
    g1.add_argument("--out-dir", default="./arena_diff", help="Output directory (default: ./arena_diff)")
    g1.add_argument("--fetch-cases", action="store_true",
                    help="Also fetch and compare case-level data for top-N exercises")
    g1.add_argument("--top-n", type=int, default=5,
                    help="Number of top exercises (by score diff) to fetch cases for (default: 5)")
    g1.add_argument("--cases-limit", type=int, default=50,
                    help="Max cases to fetch per exercise (default: 50)")

    g2 = parser.add_argument_group("YAML-only comparison")
    g2.add_argument("--config-a", help="Path to Task A YAML config")
    g2.add_argument("--config-b", help="Path to Task B YAML config")
    g2.add_argument("--json-output", default=None, help="Write YAML diff as JSON")

    args = parser.parse_args()

    if args.sid_a and args.sid_b:
        sid_a = _extract_sid(args.sid_a)
        sid_b = _extract_sid(args.sid_b)
        return run_full_compare(
            sid_a, sid_b, args.out_dir,
            fetch_cases=args.fetch_cases,
            top_n=args.top_n,
            cases_limit=args.cases_limit,
        )
    elif args.config_a and args.config_b:
        return run_yaml_compare(args.config_a, args.config_b, args.json_output)
    else:
        parser.print_help()
        print("\n请提供 --sid-a/--sid-b 或 --config-a/--config-b", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
