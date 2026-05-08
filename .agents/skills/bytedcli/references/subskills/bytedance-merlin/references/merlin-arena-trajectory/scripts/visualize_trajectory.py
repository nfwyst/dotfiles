#!/usr/bin/env python3
"""Render a trajectory JSONL as self-contained interactive HTML for browser viewing."""

from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

C = {
    "bg": "#1e1e1e", "text": "#d4d4d4", "muted": "#8c8c8c",
    "accent": "#569cd6", "user": "#6a9955", "assistant": "#ce9178",
    "warning": "#f48771", "function": "#dcdcaa", "type": "#4ec9b0",
    "border": "#3e3e42", "bg2": "#2d2d30", "nav_active": "#f48771",
}

TYPE_META: Dict[str, Dict[str, str]] = {
    "sample_preprocess":  {"label": "Sample Preprocess",  "color": C["type"],      "desc": "将原始样本数据转换为模型可评估的 instance 格式"},
    "instance":           {"label": "Instance",           "color": C["accent"],    "desc": "一条样本的一次评估 trial 的完整生命周期"},
    "instance_loop":      {"label": "Instance Infer",     "color": C["accent"],    "desc": "推理主循环，可能包含多轮对话（multi-turn agent loop）"},
    "session":            {"label": "Session",            "color": C["function"],  "desc": "一次连续会话，包含该 session 内所有 chat 轮次"},
    "chat_completion":    {"label": "Chat Completion",    "color": C["function"],  "desc": "一轮完整的模型调用：预处理 → 请求 → 后处理"},
    "model_preprocess":   {"label": "Model Preprocess",   "color": C["muted"],     "desc": "模型调用前的 prompt 预处理（SP 注入、上下文裁剪、模板渲染）"},
    "sp_strategy":        {"label": "SP Strategy",        "color": C["muted"],     "desc": "系统提示词注入：添加 thinking SP、tool SP、arena 配置的 SP"},
    "context_management": {"label": "Context Mgmt",       "color": C["muted"],     "desc": "轮次间上下文管理：控制 think/tool 内容在后续轮次的可见性"},
    "apply_chat_template":{"label": "Tokenizer",          "color": C["muted"],     "desc": "将 messages 列表通过 chat_template 转换为模型原始输入"},
    "model":              {"label": "Model",              "color": C["assistant"], "desc": "模型推理根节点"},
    "model_call":         {"label": "Model Request",      "color": C["assistant"], "desc": "推理模型实际 HTTP 请求：发送到模型服务的完整请求和返回"},
    "judge_model_call":   {"label": "Judge Request",      "color": C["warning"],   "desc": "裁判模型 HTTP 请求：metrics 阶段的打分/评判调用"},
    "model_postprocess":  {"label": "Model Postprocess",  "color": C["assistant"], "desc": "模型输出后处理：提取 think 内容、解析 tool_calls"},
    "instance_metrics":   {"label": "Instance Metrics",   "color": C["type"],      "desc": "Instance 级指标计算（可能包含 judge 模型打分）"},
    "sample_metrics":     {"label": "Sample Metrics",     "color": C["type"],      "desc": "Sample 级指标聚合"},
    "exercise_metrics":   {"label": "Exercise Metrics",   "color": C["type"],      "desc": "Exercise 级指标聚合"},
    "exercise":           {"label": "Exercise",           "color": C["accent"],    "desc": "评估集根节点"},
    "data_load":          {"label": "Data Load",          "color": C["muted"],     "desc": "数据加载"},
    "sample":             {"label": "Sample",             "color": C["accent"],    "desc": "样本根节点"},
}


def _m(t: str) -> Dict[str, str]:
    return TYPE_META.get(t, {"label": t, "color": C["muted"], "desc": ""})


def _e(s: str) -> str:
    return html.escape(s)


def _dur(s: int, e: int) -> str:
    if not s or not e: return ""
    ms = e - s
    if ms < 0: return ""
    if ms < 1000: return f"{ms}ms"
    if ms < 60_000: return f"{ms/1000:.1f}s"
    m, sec = divmod(ms, 60_000)
    return f"{int(m)}m {sec/1000:.0f}s"


def _tok(t: Optional[int]) -> str:
    if t is None: return ""
    try:
        t = int(t)
    except (TypeError, ValueError):
        return ""
    return f"{t:,}" if t < 10_000 else f"{t/1000:.1f}k"


def _json_pre(obj: Any, limit: int = 12000) -> str:
    raw = json.dumps(obj, ensure_ascii=False, indent=2)
    if len(raw) > limit:
        raw = raw[:limit] + "\n... (truncated)"
    return _e(raw)


# ---------------------------------------------------------------------------
# Specialized detail renderers
# ---------------------------------------------------------------------------

def _render_messages_as_chat(messages: list) -> str:
    """Render a list of {role, content} dicts as styled chat bubbles."""
    if not isinstance(messages, list):
        return ""
    parts: list[str] = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        if isinstance(content, list):
            texts = []
            for block in content:
                if isinstance(block, dict) and block.get("text"):
                    texts.append(block["text"])
                elif isinstance(block, dict) and block.get("type") == "image_url":
                    texts.append("[image]")
            content = "\n".join(texts)
        if isinstance(content, dict):
            content = json.dumps(content, ensure_ascii=False, indent=2)
        content = str(content)
        if len(content) > 6000:
            content = content[:6000] + "\n... (truncated)"

        role_cls = {"system": "msg-sys", "user": "msg-usr", "assistant": "msg-ast"}.get(role, "msg-oth")
        role_label = {"system": "SYSTEM", "user": "USER", "assistant": "ASSISTANT"}.get(role, role.upper())
        parts.append(
            f'<div class="msg {role_cls}">'
            f'<div class="msg-role">{_e(role_label)}</div>'
            f'<pre class="msg-body">{_e(content)}</pre>'
            f'</div>'
        )
    return "\n".join(parts)


def _msg_content_str(msg: dict) -> str:
    """Extract plain text from a message for comparison."""
    content = msg.get("content", "")
    if isinstance(content, list):
        return "\n".join(
            b.get("text", "") for b in content if isinstance(b, dict) and b.get("text")
        )
    return str(content)


def _compute_line_diff(old: str, new: str, max_lines: int = 300) -> str:
    """Compute a line-level diff and render as HTML with deleted/added markers.

    Uses difflib.SequenceMatcher on lines. Deleted lines get strikethrough + red,
    added lines get green highlight, unchanged lines render normally.
    """
    import difflib

    old_lines = old.splitlines(keepends=True)
    new_lines = new.splitlines(keepends=True)
    # Truncate for performance
    if len(old_lines) > max_lines:
        old_lines = old_lines[:max_lines]
    if len(new_lines) > max_lines:
        new_lines = new_lines[:max_lines]

    sm = difflib.SequenceMatcher(None, old_lines, new_lines)
    parts: list[str] = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for line in old_lines[i1:i2]:
                parts.append(_e(line))
        elif tag == "delete":
            for line in old_lines[i1:i2]:
                parts.append(f'<span class="dl-del">{_e(line)}</span>')
        elif tag == "insert":
            for line in new_lines[j1:j2]:
                parts.append(f'<span class="dl-ins">{_e(line)}</span>')
        elif tag == "replace":
            for line in old_lines[i1:i2]:
                parts.append(f'<span class="dl-del">{_e(line)}</span>')
            for line in new_lines[j1:j2]:
                parts.append(f'<span class="dl-ins">{_e(line)}</span>')
    return "".join(parts)


def _render_messages_diff(label: str, before: list, after: list) -> str:
    """Render a before→after message diff with per-message ADDED/MODIFIED/UNCHANGED tags.

    For MODIFIED messages, shows inline line-level diff (deleted lines strikethrough,
    added lines green-highlighted).
    """
    if not isinstance(before, list):
        before = []
    if not isinstance(after, list):
        after = []
    if not before and not after:
        return ""

    b_len, a_len = len(before), len(after)
    parts: list[str] = []

    # Summary badges
    summary = f"<div class='diff-summary'>{_e(label)}: {b_len} msgs → {a_len} msgs"
    added = max(0, a_len - b_len)
    removed = max(0, b_len - a_len)
    modified = 0
    for i in range(min(b_len, a_len)):
        b_msg = before[i] if isinstance(before[i], dict) else {}
        a_msg = after[i] if isinstance(after[i], dict) else {}
        if _msg_content_str(b_msg) != _msg_content_str(a_msg):
            modified += 1
    tags = []
    if added:
        tags.append(f'<span class="diff-badge diff-badge-add">+{added} ADDED</span>')
    if removed:
        tags.append(f'<span class="diff-badge diff-badge-rm">-{removed} REMOVED</span>')
    if modified:
        tags.append(f'<span class="diff-badge diff-badge-mod">{modified} MODIFIED</span>')
    if not tags:
        tags.append('<span class="diff-badge diff-badge-same">UNCHANGED</span>')
    summary += " " + " ".join(tags) + "</div>"
    parts.append(summary)

    # Per-message rendering
    for i, msg in enumerate(after):
        if not isinstance(msg, dict):
            continue
        role = msg.get("role", "unknown")
        content = _msg_content_str(msg)

        role_cls = {"system": "msg-sys", "user": "msg-usr", "assistant": "msg-ast"}.get(role, "msg-oth")
        role_label = {"system": "SYSTEM", "user": "USER", "assistant": "ASSISTANT"}.get(role, role.upper())

        if i >= b_len:
            # New message
            tag = '<span class="diff-badge diff-badge-add">ADDED</span>'
            if len(content) > 6000:
                content = content[:6000] + "\n... (truncated)"
            body = f'<pre class="msg-body">{_e(content)}</pre>'
            border_cls = "msg-diff-add"
        elif _msg_content_str(before[i]) != content:
            # Modified message — show inline diff
            tag = '<span class="diff-badge diff-badge-mod">MODIFIED</span>'
            old_content = _msg_content_str(before[i])
            body = f'<pre class="msg-body msg-body-diff">{_compute_line_diff(old_content, content)}</pre>'
            border_cls = "msg-diff-mod"
        else:
            # Unchanged
            tag = ""
            if len(content) > 6000:
                content = content[:6000] + "\n... (truncated)"
            body = f'<pre class="msg-body">{_e(content)}</pre>'
            border_cls = ""

        parts.append(
            f'<div class="msg {role_cls} {border_cls}">'
            f'<div class="msg-role">{_e(role_label)} {tag}</div>'
            f'{body}'
            f'</div>'
        )

    return "\n".join(parts)


def _render_usage_table(usage: dict) -> str:
    if not isinstance(usage, dict):
        return ""
    rows = "".join(
        f"<tr><td class='uk'>{_e(k)}</td><td class='uv'>{_e(str(v))}</td></tr>"
        for k, v in usage.items()
    )
    return f"<table class='usage-tbl'>{rows}</table>"


def _render_model_call_detail(span: dict) -> str:
    """Specialized renderer for model_call: chat-style messages + response + usage."""
    inp = span.get("inputs", {})
    out = span.get("outputs", {})
    if not isinstance(inp, dict):
        return ""

    parts: list[str] = []

    # Request metadata
    model = inp.get("model", "")
    url = inp.get("url", "")
    temp = inp.get("temperature")
    top_p = inp.get("top_p")
    max_tok = inp.get("max_tokens")
    meta_items = []
    if model: meta_items.append(f"model: {_e(str(model))}")
    if url: meta_items.append(f"url: {_e(str(url)[:80])}")
    if temp is not None: meta_items.append(f"temperature: {temp}")
    if top_p is not None: meta_items.append(f"top_p: {top_p}")
    if max_tok is not None: meta_items.append(f"max_tokens: {max_tok}")
    if meta_items:
        parts.append('<div class="req-meta">' + " · ".join(meta_items) + '</div>')

    # Messages as chat
    messages = inp.get("messages", [])
    if isinstance(messages, list) and messages:
        parts.append('<div class="section-label lbl-in">REQUEST MESSAGES</div>')
        parts.append(_render_messages_as_chat(messages))

    # Response
    if isinstance(out, dict):
        choices = out.get("choices", [])
        if isinstance(choices, list) and choices:
            parts.append('<div class="section-label lbl-out">RESPONSE</div>')
            for i, choice in enumerate(choices):
                if not isinstance(choice, dict):
                    continue
                msg = choice.get("message", {})
                finish = choice.get("finish_reason", "")
                content = msg.get("content", "") if isinstance(msg, dict) else ""
                if isinstance(content, str) and len(content) > 6000:
                    content = content[:6000] + "\n... (truncated)"
                parts.append(
                    f'<div class="msg msg-ast">'
                    f'<div class="msg-role">ASSISTANT <span class="finish-reason">{_e(str(finish))}</span></div>'
                    f'<pre class="msg-body">{_e(str(content))}</pre>'
                    f'</div>'
                )

        # Usage
        usage = out.get("usage", {})
        if isinstance(usage, dict) and usage:
            parts.append('<div class="section-label" style="color:#c586c0">USAGE</div>')
            parts.append(_render_usage_table(usage))

    return "\n".join(parts)


def _render_sp_detail(span: dict) -> str:
    """Show before/after messages for SP Strategy with per-message diff tags."""
    inp = span.get("inputs", {})
    out = span.get("outputs", {})
    before = inp.get("input_messages", inp) if isinstance(inp, dict) else inp
    after = out.get("output_messages", out) if isinstance(out, dict) else out
    return _render_messages_diff("SP Strategy", before if isinstance(before, list) else [], after if isinstance(after, list) else [])


def _render_ctx_mgmt_detail(span: dict) -> str:
    """Show context management before/after with per-message diff tags."""
    inp = span.get("inputs", {})
    out = span.get("outputs", {})
    before = inp.get("input_messages", []) if isinstance(inp, dict) else []
    after = out.get("output_messages", []) if isinstance(out, dict) else []
    return _render_messages_diff("Context Management", before if isinstance(before, list) else [], after if isinstance(after, list) else [])


def _render_postprocess_detail(span: dict) -> str:
    """Show model postprocess text/tool_calls diff."""
    inp = span.get("inputs", {})
    out = span.get("outputs", {})
    parts: list[str] = []
    in_text = inp.get("text", "") if isinstance(inp, dict) else ""
    out_text = out.get("text", "") if isinstance(out, dict) else ""
    in_tools = inp.get("tool_calls") if isinstance(inp, dict) else None
    out_tools = out.get("tool_calls") if isinstance(out, dict) else None

    if in_text or out_text:
        changed = in_text != out_text
        parts.append(f'<div class="section-label lbl-out">OUTPUT TEXT {"(modified)" if changed else "(unchanged)"}</div>')
        text = out_text or in_text
        if isinstance(text, str) and len(text) > 4000:
            text = text[:4000] + "\n... (truncated)"
        parts.append(f'<pre class="msg-body" style="margin:4px 0">{_e(str(text))}</pre>')
    if out_tools:
        parts.append(f'<div class="section-label" style="color:{C["function"]}">TOOL CALLS</div>')
        parts.append(f'<pre class="jp">{_json_pre(out_tools)}</pre>')
    return "\n".join(parts)


def _render_metrics_detail(span: dict) -> str:
    """Render instance/sample/exercise metrics as a table."""
    out = span.get("outputs", {})
    if not isinstance(out, dict) or not out:
        return ""
    parts: list[str] = ['<div class="section-label lbl-out">METRICS</div>']
    rows = ""
    for k, v in out.items():
        rows += f"<tr><td class='uk'>{_e(str(k))}</td><td class='uv'>{_e(json.dumps(v, ensure_ascii=False)[:200])}</td></tr>"
    if rows:
        parts.append(f"<table class='usage-tbl'>{rows}</table>")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Tree builder + node renderer
# ---------------------------------------------------------------------------

def build_tree(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_id: Dict[str, Dict[str, Any]] = {}
    for r in records:
        r["_ch"] = []
        by_id[r["call_id"]] = r
    child_set: set = set()
    for r in records:
        for cid in r.get("children_call_ids", []):
            child_set.add(cid)
            if cid in by_id:
                r["_ch"].append(by_id[cid])
    return [r for r in records if r["call_id"] not in child_set]


def _node_html(node: Dict[str, Any], counter: list, nav_entries: list, depth: int = 0) -> str:
    counter[0] += 1
    uid = counter[0]
    ct = node.get("type", "unknown")
    meta = _m(ct)
    dur = _dur(node.get("started_at", 0), node.get("ended_at", 0))
    tok = _tok(node.get("tokens"))
    status = node.get("status", "")
    exc = node.get("exception")
    children = node.get("_ch", [])
    span = node.get("span_data") or {}
    has_detail = bool(span) or bool(exc)
    has_ch = bool(children)
    expandable = has_ch or has_detail

    nav_entries.append({"uid": uid, "type": ct, "label": meta["label"], "dur": dur, "tok": tok, "depth": depth})

    src_link = node.get("source_code_link") or ""

    si_html = {'success': f'<span class="si si-ok">✓</span>', 'error': f'<span class="si si-err">✗</span>'}.get(
        status, f'<span class="si si-pen">○</span>'
    )

    chips = ""
    if dur: chips += f'<span class="chip chip-dur">{dur}</span>'
    if tok: chips += f'<span class="chip chip-tok">{tok} tok</span>'
    if exc:
        exc_preview = exc.strip().splitlines()[-1][:80] if exc.strip() else "error"
        chips += f'<span class="chip chip-exc" title="{_e(exc[:200])}">ERR: {_e(exc_preview)}</span>'
    if ct == "session":
        sid = (span.get("session_id") or "")[:16]
        if sid: chips += f'<span class="chip chip-sid">{_e(sid)}</span>'

    call_id = node.get("call_id", "")
    call_id_short = call_id[:16] if call_id else ""

    out: list[str] = []
    out.append(f'<div class="nd" id="n{uid}" data-type="{ct}" data-status="{status}">')

    cursor = ' cur' if expandable else ''
    toggle = f'<span class="tg" id="tg{uid}">[+]</span>' if expandable else '<span class="tg-ph"></span>'
    out.append(f'  <div class="nd-hd{cursor}" onclick="T({uid})">')
    out.append(f'    {toggle}')
    out.append(f'    <span class="tp" style="color:{meta["color"]}">{_e(meta["label"])}</span>')
    out.append(f'    {si_html}')
    desc = meta.get("desc", "")
    if desc:
        out.append(f'    <span class="nd-desc">{_e(desc)}</span>')
    if chips:
        out.append(f'    <span class="chips">{chips}</span>')
    if call_id:
        out.append(f'    <span class="cid" title="{_e(call_id)}" onclick="navigator.clipboard.writeText(\'{_e(call_id)}\');this.classList.add(\'cid-copied\');setTimeout(()=>this.classList.remove(\'cid-copied\'),800);event.stopPropagation()">{_e(call_id_short)}</span>')
    out.append('  </div>')

    # Detail pane — use specialized renderers
    if has_detail:
        out.append(f'  <div class="nd-det hidden" id="d{uid}">')
        if exc:
            out.append(f'    <div class="exc-box">{_e(exc[:2000])}</div>')

        specialized = _render_specialized(ct, span)
        if specialized:
            out.append(specialized)
        else:
            # Fallback: generic INPUTS/OUTPUTS JSON
            for key in ("inputs", "outputs"):
                val = span.get(key)
                if val is None:
                    continue
                lbl_cls = "lbl-in" if key == "inputs" else "lbl-out"
                out.append(f'    <div class="span-sec">')
                out.append(f'      <div class="span-hd {lbl_cls}" onclick="TS(this)"><span>[+]</span> {key.upper()}</div>')
                out.append(f'      <div class="span-body hidden"><pre class="jp">{_json_pre(val)}</pre></div>')
                out.append(f'    </div>')
            for key, val in span.items():
                if key in ("inputs", "outputs"): continue
                out.append(f'    <div class="span-kv"><span class="sk">{_e(key)}:</span> <span class="sv">{_e(str(val)[:300])}</span></div>')

        if src_link:
            out.append(f'    <div class="src-link"><span class="sk">source:</span> '
                        f'<a href="{_e(src_link)}" target="_blank" class="src-a">{_e(src_link[:120])}</a></div>')

        out.append('  </div>')

    if has_ch:
        out.append(f'  <div class="nd-ch hidden" id="c{uid}">')
        for child in children:
            out.append(_node_html(child, counter, nav_entries, depth + 1))
        out.append('  </div>')

    out.append('</div>')
    return "\n".join(out)


def _render_chat_template_detail(span: dict) -> str:
    """Show apply_chat_template before/after with per-message diff tags."""
    inp = span.get("inputs", {})
    out = span.get("outputs", {})
    before = inp.get("input_messages", []) if isinstance(inp, dict) else (inp if isinstance(inp, list) else [])
    after = out.get("output_messages", []) if isinstance(out, dict) else (out if isinstance(out, list) else [])
    return _render_messages_diff("Tokenizer (Apply Chat Template)", before, after)


def _render_specialized(ct: str, span: dict) -> str:
    """Route to specialized renderers. Returns empty string if no specialized renderer."""
    if ct in ("model_call", "judge_model_call") and span.get("inputs"):
        return _render_model_call_detail(span)
    if ct == "sp_strategy" and span:
        return _render_sp_detail(span)
    if ct == "context_management" and span:
        return _render_ctx_mgmt_detail(span)
    if ct == "apply_chat_template" and span:
        return _render_chat_template_detail(span)
    if ct == "model_postprocess" and span:
        return _render_postprocess_detail(span)
    if ct in ("instance_metrics", "sample_metrics", "exercise_metrics") and span:
        return _render_metrics_detail(span)
    return ""


# ---------------------------------------------------------------------------
# Page generation
# ---------------------------------------------------------------------------

def _nav_html(entries: list) -> str:
    parts: list[str] = []
    for e in entries:
        color = _m(e["type"])["color"]
        extra = f' <span class="nav-dur">{e["dur"]}</span>' if e["dur"] else ""
        if e["tok"]:
            extra += f' <span class="nav-tok">{e["tok"]}</span>'
        indent = e.get("depth", 0)
        pad = indent * 12
        parts.append(
            f'<a class="nav-item" href="#n{e["uid"]}" data-type="{e["type"]}" '
            f'onclick="J({e["uid"]})" style="padding-left:{pad + 12}px">'
            f'<span style="color:{color}">{_e(e["label"])}</span>{extra}</a>'
        )
    return "\n".join(parts)


def generate_html(records: List[Dict[str, Any]], title: str = "Trajectory") -> str:
    tree = build_tree(records)
    counter = [0]
    nav_entries: list = []
    tree_html = "\n".join(_node_html(root, counter, nav_entries) for root in tree)
    nav_html = _nav_html(nav_entries)

    total = len(records)
    types_seen = sorted(set(r.get("type", "?") for r in records))
    filter_buttons = "\n".join(
        f'<label class="flt-label" data-ft="{t}">'
        f'<input type="checkbox" checked onchange="FT()">'
        f'<span style="color:{_m(t)["color"]}">{_m(t)["label"]}</span></label>'
        for t in types_seen
    )

    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{_e(title)}</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{
  font-size:12px;background:{C["bg"]};color:{C["text"]};
  font-family:'Cascadia Code','Fira Code','SF Mono','Consolas',monospace;
  line-height:1.6;height:100%;
}}
body{{display:flex;flex-direction:column}}

/* Header */
.hdr{{border-bottom:1px solid {C["border"]};padding:10px 16px;flex-shrink:0}}
.hdr .title{{color:{C["warning"]};font-weight:700;font-size:13px}}
.hdr .sub{{color:{C["muted"]};font-size:11px}}

/* Toolbar row */
.tb{{
  display:flex;flex-wrap:wrap;align-items:center;gap:6px;
  padding:6px 16px;border-bottom:1px solid {C["border"]};flex-shrink:0;
}}
.tb span,.tb button{{
  cursor:pointer;color:{C["text"]};padding:2px 8px;
  font-size:11px;background:none;border:none;font-family:inherit;
}}
.tb span:hover,.tb button:hover{{color:{C["nav_active"]}}}
.search-box{{
  margin-left:auto;display:flex;align-items:center;gap:4px;
}}
.search-box input{{
  background:{C["bg2"]};border:1px solid {C["border"]};color:{C["text"]};
  padding:3px 8px;font-size:11px;font-family:inherit;width:200px;border-radius:2px;
}}
.search-box input::placeholder{{color:{C["muted"]}}}
.search-box input:focus{{outline:1px solid {C["accent"]};border-color:{C["accent"]}}}

/* Filter row */
.flt-row{{
  display:flex;flex-wrap:wrap;gap:8px;
  padding:4px 16px 6px;border-bottom:1px solid {C["border"]};flex-shrink:0;
}}
.flt-label{{
  display:flex;align-items:center;gap:3px;font-size:11px;cursor:pointer;
  user-select:none;
}}
.flt-label input{{accent-color:{C["accent"]};cursor:pointer}}
.flt-label span{{transition:opacity .15s}}
.flt-label input:not(:checked)+span{{opacity:.35;text-decoration:line-through}}

/* Layout: sidebar + resizer + main */
.layout{{display:flex;flex:1;overflow:hidden}}

/* Sidebar nav */
.sidebar{{
  width:240px;min-width:120px;flex-shrink:0;
  overflow-y:auto;overflow-x:auto;padding:8px 0;
  background:{C["bg"]};
}}
.resizer{{
  width:4px;flex-shrink:0;cursor:col-resize;
  background:{C["border"]};transition:background .15s;
}}
.resizer:hover,.resizer.dragging{{background:{C["accent"]}}}
.nav-item{{
  display:block;padding:2px 12px;font-size:11px;
  text-decoration:none;color:{C["text"]};
  white-space:nowrap;
  transition:background .1s;
}}
.nav-item:hover{{background:{C["bg2"]}}}
.nav-item.active{{background:rgba(86,156,214,0.15);border-right:2px solid {C["accent"]}}}
.nav-dur{{color:{C["muted"]};margin-left:4px}}
.nav-tok{{color:#c586c0;margin-left:2px}}

/* Main content */
.main{{flex:1;overflow-y:auto;padding:8px 16px 60px}}

/* Node */
.nd{{margin:0}}
.nd.nd-hidden{{display:none!important}}
.nd-hd{{
  display:flex;align-items:center;gap:6px;
  padding:3px 4px;transition:background .1s;user-select:none;font-size:12px;
}}
.nd-hd.cur{{cursor:pointer}}
.nd-hd.cur:hover{{background:{C["bg2"]}}}
.nd-hd.search-hit{{background:rgba(139,105,20,0.3)}}
.tg{{color:{C["muted"]};font-size:11px;width:20px;text-align:center;flex-shrink:0}}
.tg-ph{{width:20px;flex-shrink:0}}
.tp{{font-weight:700;white-space:nowrap;font-size:12px}}
.nd-desc{{color:{C["muted"]};font-size:10px;font-style:italic;margin-left:4px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:360px}}
.si{{font-size:11px;flex-shrink:0}}
.si-ok{{color:{C["type"]}}}.si-err{{color:{C["warning"]}}}.si-pen{{color:{C["function"]}}}
.chips{{display:flex;gap:6px;margin-left:auto;align-items:center;flex-shrink:0}}
.chip{{font-size:10px;padding:1px 6px;border-radius:2px;white-space:nowrap}}
.chip-dur{{color:{C["accent"]};background:rgba(86,156,214,0.12)}}
.chip-tok{{color:#c586c0;background:rgba(197,134,192,0.12)}}
.chip-exc{{color:#fff;background:rgba(244,135,113,0.4);font-weight:700;white-space:normal;max-width:500px;overflow:hidden;text-overflow:ellipsis}}
.chip-sid{{color:{C["function"]};background:rgba(220,220,170,0.1)}}
.cid{{
  font-size:9px;color:{C["muted"]};opacity:.4;cursor:pointer;
  margin-left:6px;flex-shrink:0;font-family:inherit;
  transition:opacity .15s,color .15s;
}}
.cid:hover{{opacity:1;color:{C["accent"]}}}
.cid-copied{{opacity:1!important;color:{C["type"]}!important}}

/* Detail pane */
.nd-det{{margin-left:26px;padding:4px 0}}
.exc-box{{
  background:rgba(244,135,113,0.1);border:1px solid rgba(244,135,113,0.3);
  color:{C["warning"]};padding:8px 12px;border-radius:2px;font-size:12px;
  margin-bottom:4px;white-space:pre-wrap;
}}
.span-sec{{margin:2px 0}}
.span-hd{{cursor:pointer;font-size:12px;font-weight:600;padding:2px 0;transition:color .1s}}
.span-hd:hover{{color:#fff}}
.span-hd span{{color:{C["muted"]};margin-right:4px}}
.lbl-in{{color:{C["accent"]}}}.lbl-out{{color:{C["type"]}}}
.section-label{{font-size:11px;font-weight:700;margin:8px 0 4px;padding:2px 0;
  border-bottom:1px solid {C["border"]}}}
.jp{{
  font-size:12px;color:{C["text"]};background:{C["bg2"]};
  padding:8px 12px;border-radius:2px;overflow-x:auto;max-height:500px;overflow-y:auto;
  white-space:pre-wrap;word-break:break-all;margin:2px 0;border:1px solid {C["border"]};
}}
.span-kv{{font-size:12px;color:{C["muted"]};margin:2px 0}}
.sk{{color:{C["accent"]}}}.sv{{color:{C["assistant"]}}}
.nd-ch{{margin-left:10px;padding-left:14px;border-left:1px solid {C["border"]}}}

/* Chat message bubbles */
.msg{{margin:4px 0;border-left:3px solid {C["border"]};padding:0 0 0 10px}}
.msg-sys{{border-color:{C["muted"]}}}
.msg-usr{{border-color:{C["user"]}}}
.msg-ast{{border-color:{C["assistant"]}}}
.msg-oth{{border-color:{C["function"]}}}
.msg-role{{font-size:10px;font-weight:700;margin-bottom:1px}}
.msg-sys .msg-role{{color:{C["muted"]}}}.msg-usr .msg-role{{color:{C["user"]}}}
.msg-ast .msg-role{{color:{C["assistant"]}}}.msg-oth .msg-role{{color:{C["function"]}}}
.msg-body{{
  font-size:12px;background:{C["bg2"]};padding:6px 10px;border-radius:2px;
  white-space:pre-wrap;word-break:break-all;max-height:500px;overflow-y:auto;
  margin:0;border:1px solid {C["border"]};color:{C["text"]};
}}
.finish-reason{{font-weight:400;color:{C["muted"]};margin-left:6px;font-size:10px}}

/* Diff summary + badges */
.diff-summary{{font-size:11px;color:{C["muted"]};margin:6px 0 4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}}
.diff-badge{{font-size:10px;font-weight:700;padding:1px 7px;border-radius:3px;letter-spacing:.3px}}
.diff-badge-add{{color:#fff;background:#2ea04370;border:1px solid #2ea043}}
.diff-badge-rm{{color:#fff;background:#f8514970;border:1px solid #f85149}}
.diff-badge-mod{{color:#fff;background:#d29922a0;border:1px solid #d29922}}
.diff-badge-same{{color:{C["muted"]};background:{C["bg2"]};border:1px solid {C["border"]}}}
/* Per-message diff borders */
.msg-diff-add{{border-left-color:#2ea043!important;background:rgba(46,160,67,0.06)}}
.msg-diff-mod{{border-left-color:#d29922!important;background:rgba(210,153,34,0.06)}}
/* Inline line-level diff inside MODIFIED messages */
.msg-body-diff{{white-space:pre-wrap}}
.dl-del{{background:rgba(248,81,73,0.15);color:#f85149;text-decoration:line-through}}
.dl-ins{{background:rgba(46,160,67,0.15);color:#3fb950}}

/* Request metadata */
.req-meta{{font-size:11px;color:{C["muted"]};margin:4px 0;padding:4px 8px;
  background:{C["bg2"]};border-radius:2px;border:1px solid {C["border"]}}}

/* Usage / metrics table */
.usage-tbl{{border-collapse:collapse;font-size:11px;margin:4px 0}}
.usage-tbl td{{padding:2px 12px 2px 0}}
.uk{{color:{C["accent"]}}}.uv{{color:{C["text"]}}}

/* Source code link */
.src-link{{font-size:11px;margin:6px 0 2px;padding:3px 8px;
  background:{C["bg2"]};border:1px solid {C["border"]};border-radius:2px}}
.src-a{{color:{C["accent"]};text-decoration:underline}}
.src-a:hover{{color:#fff}}

.hidden{{display:none!important}}
</style>
</head>
<body>
<div class="hdr">
  <div class="title">~ trajectory {_e(title)}</div>
  <div class="sub">{total} calls</div>
</div>
<div class="tb">
  <span onclick="EA()">expand all</span>
  <span onclick="CA()">collapse all</span>
  <span onclick="ED(1)">depth 1</span>
  <span onclick="ED(2)">depth 2</span>
  <span onclick="ED(3)">depth 3</span>
  <span onclick="SC()">show chat only</span>
  <span onclick="SE()">show errors</span>
  <div class="search-box">
    <input id="searchInput" type="text" placeholder="search content..." oninput="doSearch(this.value)">
    <span id="searchCount" style="font-size:10px;color:{C["muted"]}"></span>
  </div>
</div>
<div class="flt-row" id="filterRow">
  {filter_buttons}
</div>
<div class="layout">
  <div class="sidebar" id="sidebar">
    {nav_html}
  </div>
  <div class="resizer" id="resizer"></div>
  <div class="main" id="mainPanel">
    {tree_html}
  </div>
</div>
<script>
/* Toggle node */
function T(id){{
  var d=document.getElementById('d'+id),c=document.getElementById('c'+id),g=document.getElementById('tg'+id);
  if(!d&&!c)return;
  var isOpen=(d&&!d.classList.contains('hidden'))||(c&&!c.classList.contains('hidden'));
  if(isOpen){{
    if(d)d.classList.add('hidden');
    if(c)c.classList.add('hidden');
    if(g)g.textContent='[+]';
  }}else{{
    if(d)d.classList.remove('hidden');
    if(c)c.classList.remove('hidden');
    if(g)g.textContent='[-]';
  }}
}}
/* Toggle span section */
function TS(el){{
  var b=el.nextElementSibling,s=el.querySelector('span');
  if(b){{var h=b.classList.contains('hidden');b.classList.toggle('hidden',!h);if(s)s.textContent=h?'[-]':'[+]'}}
}}
/* Expand/collapse all */
function EA(){{
  document.querySelectorAll('.nd-det,.nd-ch,.span-body').forEach(function(e){{e.classList.remove('hidden')}});
  document.querySelectorAll('.tg').forEach(function(e){{e.textContent='[-]'}});
  document.querySelectorAll('.span-hd span').forEach(function(e){{e.textContent='[-]'}});
}}
function CA(){{
  document.querySelectorAll('.nd-det,.nd-ch,.span-body').forEach(function(e){{e.classList.add('hidden')}});
  document.querySelectorAll('.tg').forEach(function(e){{e.textContent='[+]'}});
  document.querySelectorAll('.span-hd span').forEach(function(e){{e.textContent='[+]'}});
}}
function gd(el){{var d=0,p=el.parentElement;while(p){{if(p.classList&&p.classList.contains('nd-ch'))d++;p=p.parentElement}}return d}}
function ED(mx){{
  CA();
  document.querySelectorAll('.nd').forEach(function(n){{
    if(gd(n)<=mx){{
      var id=n.id.replace('n','');
      var d=document.getElementById('d'+id),c=document.getElementById('c'+id),g=document.getElementById('tg'+id);
      if(d)d.classList.remove('hidden');if(c)c.classList.remove('hidden');if(g)g.textContent='[-]';
    }}
  }});
}}
/* Show chat only: expand path to all chat_completion + model_call nodes */
function SC(){{
  CA();
  var targets=['chat_completion','model_call','judge_model_call','session','instance_loop','instance','model','model_postprocess'];
  document.querySelectorAll('.nd').forEach(function(n){{
    var t=n.getAttribute('data-type');
    if(targets.indexOf(t)>=0){{
      var id=n.id.replace('n','');
      var d=document.getElementById('d'+id),c=document.getElementById('c'+id),g=document.getElementById('tg'+id);
      if(d)d.classList.remove('hidden');if(c)c.classList.remove('hidden');if(g)g.textContent='[-]';
      /* also expand parents */
      var p=n.parentElement;
      while(p){{
        if(p.classList&&p.classList.contains('nd-ch')){{p.classList.remove('hidden');var pp=p.previousElementSibling;if(pp){{var pg=pp.parentElement;if(pg){{var pid=pg.id.replace('n','');var ptg=document.getElementById('tg'+pid);if(ptg)ptg.textContent='[-]'}}}}}}
        p=p.parentElement;
      }}
    }}
  }});
}}
/* Show errors: expand only non-success nodes */
function SE(){{
  CA();
  document.querySelectorAll('.nd').forEach(function(n){{
    var st=n.getAttribute('data-status');
    if(st&&st!=='success'&&st!==''){{
      var id=n.id.replace('n','');
      var d=document.getElementById('d'+id),c=document.getElementById('c'+id),g=document.getElementById('tg'+id);
      if(d)d.classList.remove('hidden');if(g)g.textContent='[-]';
      n.querySelector(':scope>.nd-hd').classList.add('search-hit');
      var p=n.parentElement;
      while(p){{
        if(p.classList&&p.classList.contains('nd-ch')){{p.classList.remove('hidden');var pp=p.parentElement;if(pp){{var pid=pp.id.replace('n','');var ptg=document.getElementById('tg'+pid);if(ptg)ptg.textContent='[-]'}}}}
        p=p.parentElement;
      }}
    }}
  }});
  var errs=document.querySelectorAll('.nd[data-status]:not([data-status="success"]):not([data-status=""])');
  document.getElementById('searchCount').textContent=errs.length>0?errs.length+' errors':'all success';
}}
/* Jump via nav */
function J(id){{
  var el=document.getElementById('n'+id);if(!el)return;
  /* Expand parents */
  var p=el.parentElement;
  while(p){{
    if(p.classList&&p.classList.contains('nd-ch')){{p.classList.remove('hidden');var pp=p.parentElement;if(pp){{var pid=pp.id.replace('n','');var ptg=document.getElementById('tg'+pid);if(ptg)ptg.textContent='[-]'}}}}
    p=p.parentElement;
  }}
  /* expand self */
  var uid=el.id.replace('n','');
  var d=document.getElementById('d'+uid),c=document.getElementById('c'+uid),g=document.getElementById('tg'+uid);
  if(d)d.classList.remove('hidden');if(c)c.classList.remove('hidden');if(g)g.textContent='[-]';
  el.scrollIntoView({{behavior:'smooth',block:'start'}});
  /* highlight nav */
  document.querySelectorAll('.nav-item').forEach(function(a){{a.classList.remove('active')}});
  var navA=document.querySelector('.nav-item[onclick="J('+id+')"]');
  if(navA)navA.classList.add('active');
}}
/* Filter by type */
function FT(){{
  var checks=document.querySelectorAll('.flt-row input[type=checkbox]');
  var labels=document.querySelectorAll('.flt-row .flt-label');
  var visible=new Set();
  labels.forEach(function(l,i){{if(checks[i].checked)visible.add(l.getAttribute('data-ft'))}});
  document.querySelectorAll('.nd').forEach(function(n){{
    var t=n.getAttribute('data-type');
    if(visible.has(t))n.classList.remove('nd-hidden');
    else n.classList.add('nd-hidden');
  }});
  document.querySelectorAll('.nav-item').forEach(function(a){{
    var t=a.getAttribute('data-type');
    if(visible.has(t))a.style.display='';
    else a.style.display='none';
  }});
}}
/* Search */
var searchTimer;
function doSearch(q){{
  clearTimeout(searchTimer);
  searchTimer=setTimeout(function(){{_doSearch(q)}},200);
}}
function _doSearch(q){{
  document.querySelectorAll('.search-hit').forEach(function(e){{e.classList.remove('search-hit')}});
  var countEl=document.getElementById('searchCount');
  if(!q||q.length<2){{countEl.textContent='';return}}
  var lower=q.toLowerCase();var hits=0;
  document.querySelectorAll('.nd-det').forEach(function(det){{
    if(det.textContent.toLowerCase().indexOf(lower)>=0){{
      det.classList.remove('hidden');
      var nd=det.parentElement;if(nd){{
        var hd=nd.querySelector(':scope>.nd-hd');if(hd){{hd.classList.add('search-hit');hits++}}
        var uid=nd.id.replace('n','');
        var tg=document.getElementById('tg'+uid);if(tg)tg.textContent='[-]';
        /* expand parents */
        var p=nd.parentElement;
        while(p){{
          if(p.classList&&p.classList.contains('nd-ch')){{p.classList.remove('hidden');var pp=p.parentElement;if(pp){{var pid=pp.id.replace('n','');var ptg=document.getElementById('tg'+pid);if(ptg)ptg.textContent='[-]'}}}}
          p=p.parentElement;
        }}
      }}
    }}
  }});
  /* also search in span-body */
  document.querySelectorAll('.span-body').forEach(function(sb){{
    if(sb.textContent.toLowerCase().indexOf(lower)>=0){{
      sb.classList.remove('hidden');
      var sec=sb.parentElement;if(sec){{var shd=sec.querySelector('.span-hd span');if(shd)shd.textContent='[-]'}}
    }}
  }});
  countEl.textContent=hits>0?hits+' hits':'no match';
}}
/* Sidebar resizer drag */
(function(){{
  var rs=document.getElementById('resizer'),sb=document.getElementById('sidebar');
  var dragging=false,startX,startW;
  rs.addEventListener('mousedown',function(e){{
    dragging=true;startX=e.clientX;startW=sb.offsetWidth;
    rs.classList.add('dragging');
    document.body.style.cursor='col-resize';
    document.body.style.userSelect='none';
    e.preventDefault();
  }});
  document.addEventListener('mousemove',function(e){{
    if(!dragging)return;
    var w=startW+(e.clientX-startX);
    if(w<120)w=120;if(w>600)w=600;
    sb.style.width=w+'px';
  }});
  document.addEventListener('mouseup',function(){{
    if(dragging){{dragging=false;rs.classList.remove('dragging');document.body.style.cursor='';document.body.style.userSelect=''}}
  }});
}})();
/* init */
ED(2);
</script>
</body>
</html>'''


def main(argv: Optional[Sequence[str]] = None) -> int:
    p = argparse.ArgumentParser(description="Render trajectory JSONL as interactive HTML")
    p.add_argument("jsonl_path", help="Path to trajectory.jsonl")
    p.add_argument("--out", default=None, help="Output HTML path")
    p.add_argument("--title", default="Trajectory Viewer", help="Page title")
    args = p.parse_args(argv)

    jsonl_path = Path(args.jsonl_path)
    if not jsonl_path.exists():
        print(f"File not found: {jsonl_path}", file=sys.stderr)
        return 1

    records = []
    with jsonl_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))

    if not records:
        print("No records found in JSONL", file=sys.stderr)
        return 1

    out_path = Path(args.out) if args.out else jsonl_path.with_suffix(".html")
    html_content = generate_html(records, title=args.title)
    out_path.write_text(html_content, encoding="utf-8")
    print(f"Wrote {out_path} ({len(records)} calls)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
