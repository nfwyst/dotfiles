"""Trace tree normalization, session injection, pruning and simplification.

Pure data-transformation functions — no I/O, no subprocess calls.
Depends only on ``models``.
"""

from __future__ import annotations

import json
import uuid as _uuid
from typing import Any

from models import (
    METRICS_ANCESTOR_TYPES,
    NO_INSTANCE_TYPES,
    NO_SAMPLE_TYPES,
    RE_INDEX,
    RE_SESSION,
    RE_UUID,
    SIMPLIFY_BLACKLIST,
    SIMPLIFY_BLACKLIST_SUBTREE,
    NormalizedCall,
)

# ---------------------------------------------------------------------------
# Type detection
# ---------------------------------------------------------------------------


def detect_type(call: dict[str, Any]) -> str:
    op: str = call.get("OpName", "") or ""
    display: str = call.get("DisplayName") or ""
    tags: list[str] = call.get("tags") or []

    if display.startswith("[Exercise]") or (
        "Exercise" in tags
        and not {"Sample", "Instance", "Data Load and Preprocess"}.intersection(tags)
    ):
        if op.startswith("ConfigRunner.compute_exercise_metrics") or display.startswith(
            "[Exercise Metrics]"
        ):
            return "exercise_metrics"
        return "exercise"

    if op.startswith("[Data Load and Preprocess]") or "Data Load and Preprocess" in tags:
        return "data_load"
    if display.startswith("[Sample Metrics]") or op.startswith(
        "ConfigRunner.compute_sample_metrics"
    ):
        return "sample_metrics"
    if display.startswith("[Sample Preprocess]") or op.startswith("Runner.preprocess"):
        return "sample_preprocess"
    if op.startswith("[Sample]") or tags == ["Sample"]:
        return "sample"
    if display.startswith("[Instance Metrics]") or op.startswith(
        "ConfigRunner.compute_instance_metrics"
    ):
        return "instance_metrics"
    if display.startswith("[Instance Infer]") or op.startswith(
        "LLMSingleturnRunner.infer"
    ):
        return "instance_loop"
    if op.startswith("[Instance]") or tags == ["Instance"]:
        return "instance"
    if op.startswith("[Chat]") or "Chat" in tags:
        return "chat_completion"
    if op.startswith("[Model Preprocess]") or "Model Preprocess" in tags:
        return "model_preprocess"
    if op.startswith("[SP Strategy]") or "SP Strategy" in tags:
        return "sp_strategy"
    if op.startswith("[Context Management]") or "Context Management" in tags:
        return "context_management"
    if op.startswith("[Tokenizer]") or "Tokenizer" in tags:
        return "apply_chat_template"
    if op.startswith("[ModelService]") or "ModelService" in tags:
        return "model_call"
    if op.startswith("[Model Postprocess]") or "Model Postprocess" in tags:
        return "model_postprocess"
    if op.startswith("[Model]") or tags == ["Model"]:
        return "model"
    if display.startswith("[Exercise Metrics]") or op.startswith(
        "ConfigRunner.compute_exercise_metrics"
    ):
        return "exercise_metrics"
    return display or op or "unknown"


# ---------------------------------------------------------------------------
# Field extractors
# ---------------------------------------------------------------------------


def _extract_sample_uuid(op: str, display: str) -> str | None:
    for s in (op, display):
        if m := RE_UUID.search(s):
            return m.group(1)
    return None


def _extract_instance_index(op: str, display: str) -> int | None:
    for s in (op, display):
        if m := RE_INDEX.search(s):
            return int(m.group(1))
    return None


# ---------------------------------------------------------------------------
# span_data builders
# ---------------------------------------------------------------------------


def _copy(obj: Any) -> Any:
    """Sever reference to the original API response via json round-trip."""
    if obj is None or isinstance(obj, (str, int, float, bool)):
        return obj
    return json.loads(json.dumps(obj, ensure_ascii=False))


def build_span_data(call_type: str, content: Any) -> dict[str, Any]:
    """Build type-specific span_data from raw Content.

    All returned values are independent copies so the caller can ``del``
    the raw response immediately.
    """
    if not isinstance(content, dict) or not content:
        return {}
    inputs = content.get("Inputs")
    outputs = content.get("Outputs")

    if call_type == "exercise":
        return {
            "inputs": {
                "eval_spec": _copy(inputs.get("eval_spec"))
                if isinstance(inputs, dict)
                else None
            },
            "outputs": _copy(outputs) or {},
        }
    if call_type == "sample":
        return {"outputs": _copy(outputs) or {}}
    if call_type == "sample_preprocess":
        out_instances = (
            outputs.get("instances") if isinstance(outputs, dict) else None
        )
        return {
            "inputs": _copy(inputs.get("sample_data")) if isinstance(inputs, dict) else {},
            "outputs": (
                _copy(out_instances[0])
                if isinstance(out_instances, list) and out_instances
                else {}
            ),
        }
    if call_type in ("instance", "instance_metrics", "sample_metrics", "exercise_metrics"):
        return {"inputs": _copy(inputs) or {}, "outputs": _copy(outputs) or {}}
    if call_type in ("model_call", "judge_model_call"):
        return {"inputs": _copy(inputs) or {}, "outputs": _copy(outputs) or {}}
    if call_type in ("sp_strategy", "context_management", "apply_chat_template"):
        return {"inputs": _copy(inputs) or [], "outputs": _copy(outputs) or []}
    if call_type == "model_postprocess":
        inp = inputs or {}
        out = outputs or {}
        return {
            "inputs": {"text": str(inp.get("text", "")), "tool_calls": _copy(inp.get("tool_calls"))},
            "outputs": {"text": str(out.get("text", "")), "tool_calls": _copy(out.get("tool_calls"))},
        }
    if call_type == "chat_completion":
        return {"inputs": _copy(inputs) or {}, "outputs": _copy(outputs) or {}}
    result: dict[str, Any] = {}
    if inputs is not None:
        result["inputs"] = _copy(inputs)
    if outputs is not None:
        result["outputs"] = _copy(outputs)
    return result


# ---------------------------------------------------------------------------
# Normalize a single call
# ---------------------------------------------------------------------------


def _normalize_call(
    call: dict[str, Any],
    exercise_name: str,
    exercise_version_sid: str,
    parent_sample_uuid: str | None = None,
    parent_instance_index: int | None = None,
) -> NormalizedCall:
    op: str = call.get("OpName", "") or ""
    display: str = call.get("DisplayName") or ""
    call_type = detect_type(call)

    sample_uuid = _extract_sample_uuid(op, display) or parent_sample_uuid
    instance_index = _extract_instance_index(op, display)
    if instance_index is None:
        instance_index = parent_instance_index

    if call_type in NO_SAMPLE_TYPES:
        sample_uuid = None
        instance_index = None
    elif call_type in NO_INSTANCE_TYPES:
        instance_index = None

    content = call.get("Content") or {}
    exception: str | None = None
    if isinstance(content, dict) and content.get("Exception"):
        exception = str(content["Exception"])

    source_code_link: str | None = None
    attrs = content.get("Attributes", {}) if isinstance(content, dict) else {}
    if isinstance(attrs, dict) and attrs.get("source_code_link"):
        source_code_link = str(attrs["source_code_link"])
    if (fcu := call.get("func_code_url")) and not source_code_link:
        source_code_link = str(fcu)

    return NormalizedCall(
        call_id=call.get("CallID", ""),
        type=call_type,
        exercise_name=exercise_name,
        exercise_version_sid=exercise_version_sid,
        sample_internal_uuid=sample_uuid,
        instance_index=instance_index,
        started_at=int(call.get("StartedAt") or 0),
        ended_at=int(call.get("EndedAt") or 0),
        status=call.get("Status", ""),
        exception=exception,
        span_data=build_span_data(call_type, content),
        children_call_ids=[],
        source_code_link=source_code_link,
        tokens=call.get("tokens"),
    )


# ---------------------------------------------------------------------------
# Flatten trace tree
# ---------------------------------------------------------------------------


def flatten_trace_tree(
    root: dict[str, Any],
    exercise_name: str,
    exercise_version_sid: str,
) -> list[NormalizedCall]:
    """Iterative DFS pre-order flattening — O(n) without recursive list copies."""
    results: list[NormalizedCall] = []
    stack: list[tuple[dict[str, Any], str | None, int | None]] = [
        (root, None, None)
    ]

    while stack:
        node, p_uuid, p_idx = stack.pop()
        call_data = node.get("Call")
        if not call_data:
            continue

        nc = _normalize_call(
            call_data, exercise_name, exercise_version_sid, p_uuid, p_idx
        )
        results.append(nc)

        children = node.get("Children") or ()
        nc.children_call_ids = [
            c["Call"]["CallID"]
            for c in children
            if c.get("Call") and c["Call"].get("CallID")
        ]

        child_uuid = nc.sample_internal_uuid or p_uuid
        child_idx = (
            nc.instance_index if nc.instance_index is not None else p_idx
        )
        for child in reversed(children):
            stack.append((child, child_uuid, child_idx))

    return results


# ---------------------------------------------------------------------------
# Session node injection
# ---------------------------------------------------------------------------


def inject_session_nodes(
    records: list[NormalizedCall],
    trace_root: dict[str, Any] | None = None,
) -> list[NormalizedCall]:
    """Insert virtual Session nodes by grouping chat_completions via LCA.

    For each session_id (extracted from ThreadID ``[session-xxx]``):
    1. Collect all chat_completion call_ids with that session_id.
    2. Find their Lowest Common Ancestor (LCA) in the tree.
    3. Group the LCA's direct children that transitively contain those
       chat_completions under a new virtual Session node.

    This works regardless of how many custom intermediate nodes exist
    between the LCA and the chat_completions (e.g. Swalm nodes).
    """
    if trace_root is None:
        return records

    call_session_map: dict[str, str] = {}
    raw_stack = [trace_root]
    while raw_stack:
        rn = raw_stack.pop()
        call = rn.get("Call", {})
        thread_id = call.get("ThreadID", "") or ""
        call_id = call.get("CallID", "")
        if thread_id and call_id:
            if m := RE_SESSION.search(thread_id):
                call_session_map[call_id] = m.group(1)
        if ch := rn.get("Children"):
            raw_stack.extend(ch)

    if not call_session_map:
        return records

    by_id: dict[str, NormalizedCall] = {r.call_id: r for r in records}

    # --- group chat_completions by session_id ---
    session_chats: dict[str, list[str]] = {}
    for r in records:
        if r.type == "chat_completion":
            sid = call_session_map.get(r.call_id)
            if sid:
                session_chats.setdefault(sid, []).append(r.call_id)

    session_chats = {sid: cids for sid, cids in session_chats.items() if len(cids) >= 2}
    if not session_chats:
        return records

    # --- build parent_map for LCA computation ---
    parent_map: dict[str, str] = {}
    for r in records:
        for cid in r.children_call_ids:
            parent_map[cid] = r.call_id

    def _ancestors(call_id: str) -> list[str]:
        path: list[str] = []
        cur: str | None = call_id
        while cur:
            path.append(cur)
            cur = parent_map.get(cur)
        return path

    def _find_lca(call_ids: list[str]) -> str:
        common = set(_ancestors(call_ids[0]))
        for cid in call_ids[1:]:
            common &= set(_ancestors(cid))
        return max(common, key=lambda c: len(_ancestors(c)))

    # --- for each session, find LCA and determine which children to group ---
    # map: descendant call_id -> set of ancestor call_ids (for membership test)
    def _ancestor_set(call_id: str) -> set[str]:
        return set(_ancestors(call_id))

    target_sessions: dict[str, tuple[str, list[str]]] = {}
    for sid, cc_ids in session_chats.items():
        lca_id = _find_lca(cc_ids)
        lca = by_id.get(lca_id)
        if not lca:
            continue
        cc_ancestor_sets = [_ancestor_set(cid) for cid in cc_ids]
        sessionable: list[str] = []
        for child_id in lca.children_call_ids:
            if any(child_id in anc_set for anc_set in cc_ancestor_sets):
                sessionable.append(child_id)
        if sessionable:
            target_sessions[sid] = (lca_id, sessionable)

    if not target_sessions:
        return records

    # collect all LCA ids that need rewriting
    lca_ids = {lca_id for lca_id, _ in target_sessions.values()}

    # --- build new records with session nodes injected ---
    new_records: list[NormalizedCall] = []
    for rec in records:
        if rec.call_id not in lca_ids:
            new_records.append(rec)
            continue

        # collect all sessions that target this LCA
        grouped_children: set[str] = set()
        session_nodes_for_lca: list[tuple[str, NormalizedCall]] = []
        for sid, (lid, child_ids) in target_sessions.items():
            if lid != rec.call_id:
                continue
            grouped_children.update(child_ids)
            first = by_id[child_ids[0]]
            last = by_id[child_ids[-1]]
            session_cid = f"session-{sid[:32]}-{_uuid.uuid4().hex[:8]}"
            session_node = NormalizedCall(
                call_id=session_cid,
                type="session",
                exercise_name=rec.exercise_name,
                exercise_version_sid=rec.exercise_version_sid,
                sample_internal_uuid=rec.sample_internal_uuid,
                instance_index=rec.instance_index,
                started_at=first.started_at,
                ended_at=last.ended_at,
                status="success",
                exception=None,
                span_data={"session_id": sid},
                children_call_ids=list(child_ids),
                source_code_link=None,
            )
            new_records.append(session_node)
            by_id[session_cid] = session_node
            session_nodes_for_lca.append((session_cid, session_node))

        non_session = [c for c in rec.children_call_ids if c not in grouped_children]
        rec.children_call_ids = non_session + [s[0] for s in session_nodes_for_lca]
        new_records.append(rec)

    return new_records


# ---------------------------------------------------------------------------
# Prune to single instance trajectory
# ---------------------------------------------------------------------------


def extract_instance_trajectory(
    records: list[NormalizedCall],
    question_sid: str,
    trial_num: int = 0,
) -> list[NormalizedCall]:
    """Extract sample_preprocess + instance subtree for a specific sample/trial."""
    by_id: dict[str, NormalizedCall] = {r.call_id: r for r in records}

    preprocess = [
        r
        for r in records
        if r.type == "sample_preprocess" and r.sample_internal_uuid == question_sid
    ]
    instance = [
        r
        for r in records
        if r.type == "instance"
        and r.sample_internal_uuid == question_sid
        and r.instance_index == trial_num
    ]
    if not instance:
        return records

    keep_ids: set[str] = {pp.call_id for pp in preprocess}
    sub_stack = [inst.call_id for inst in instance]
    while sub_stack:
        cid = sub_stack.pop()
        if cid in keep_ids:
            continue
        keep_ids.add(cid)
        if node := by_id.get(cid):
            sub_stack.extend(node.children_call_ids)

    return [r for r in records if r.call_id in keep_ids]


# ---------------------------------------------------------------------------
# Simplify trajectory
# ---------------------------------------------------------------------------


def dedupe_model_call_retries(records: list[NormalizedCall]) -> list[NormalizedCall]:
    """Keep only the last model_call / judge_model_call child per parent, removing earlier retries.

    Model nodes may contain multiple model_call children due to retry logic;
    only the final attempt (latest started_at) is meaningful for batch analysis.
    Deduplication is done per-type so inference and judge calls are independent.
    """
    by_id: dict[str, NormalizedCall] = {r.call_id: r for r in records}

    remove_ids: set[str] = set()
    for r in records:
        for mc_type in ("model_call", "judge_model_call"):
            mc_children = [
                cid
                for cid in r.children_call_ids
                if (node := by_id.get(cid)) is not None and node.type == mc_type
            ]
            if len(mc_children) <= 1:
                continue
            mc_children.sort(key=lambda cid: by_id[cid].started_at)
            remove_ids.update(mc_children[:-1])

    if not remove_ids:
        return records

    for r in records:
        if any(cid in remove_ids for cid in r.children_call_ids):
            r.children_call_ids = [
                cid for cid in r.children_call_ids if cid not in remove_ids
            ]
    return [r for r in records if r.call_id not in remove_ids]


def simplify_trajectory(
    records: list[NormalizedCall],
    keep_types: set[str],
) -> list[NormalizedCall]:
    """Simplify trajectory tree by keeping only specified node types.

    Preserves transitive parent-child relationships: if the original tree has
    A -> B -> C and only A and C are in *keep_types*, the simplified tree will
    contain A -> C (B is collapsed, not lost).
    """
    if not keep_types:
        return records

    by_id: dict[str, NormalizedCall] = {r.call_id: r for r in records}

    def _find_kept_descendants(call_id: str) -> list[str]:
        node = by_id.get(call_id)
        if not node:
            return []
        result: list[str] = []
        for child_id in node.children_call_ids:
            child = by_id.get(child_id)
            if not child:
                continue
            if child.type in keep_types:
                result.append(child_id)
            else:
                result.extend(_find_kept_descendants(child_id))
        return result

    kept: list[NormalizedCall] = []
    for r in records:
        if r.type in keep_types:
            r.children_call_ids = _find_kept_descendants(r.call_id)
            kept.append(r)

    return kept


def reclassify_judge_model_calls(
    records: list[NormalizedCall],
) -> list[NormalizedCall]:
    """Re-type ``model_call`` nodes under metrics ancestors as ``judge_model_call``.

    Walks the parent chain for each ``model_call``; if any ancestor has a type
    in ``METRICS_ANCESTOR_TYPES`` the node is re-typed.  This makes inference
    and judge model calls distinguishable by the ``type`` field alone, enabling
    callers to include/exclude them via whitelist ``--simplify-types``.
    """
    by_id: dict[str, NormalizedCall] = {r.call_id: r for r in records}
    parent_map: dict[str, str] = {}
    for r in records:
        for cid in r.children_call_ids:
            parent_map[cid] = r.call_id

    def _has_metrics_ancestor(call_id: str) -> bool:
        cur = parent_map.get(call_id)
        while cur:
            node = by_id.get(cur)
            if node and node.type in METRICS_ANCESTOR_TYPES:
                return True
            cur = parent_map.get(cur)
        return False

    for r in records:
        if r.type == "model_call" and _has_metrics_ancestor(r.call_id):
            r.type = "judge_model_call"
    return records


def simplify_trajectory_blacklist(
    records: list[NormalizedCall],
    blacklist: set[str] | frozenset[str] = SIMPLIFY_BLACKLIST,
    blacklist_subtree: set[str] | frozenset[str] = SIMPLIFY_BLACKLIST_SUBTREE,
) -> list[NormalizedCall]:
    """Simplify trajectory tree by removing blacklisted node types.

    Nodes whose type is in *blacklist* are removed; their non-blacklisted
    children are promoted to the parent.  Nodes whose type is in
    *blacklist_subtree* (a subset of *blacklist*) are removed together with
    their entire descendant subtree.
    """
    if not blacklist:
        return records

    by_id: dict[str, NormalizedCall] = {r.call_id: r for r in records}

    subtree_removed: set[str] = set()
    for r in records:
        if r.type in blacklist_subtree and r.call_id not in subtree_removed:
            stack = [r.call_id]
            while stack:
                nid = stack.pop()
                if nid in subtree_removed:
                    continue
                subtree_removed.add(nid)
                node = by_id.get(nid)
                if node:
                    stack.extend(node.children_call_ids)

    def _resolve_children(call_id: str) -> list[str]:
        node = by_id.get(call_id)
        if not node:
            return []
        result: list[str] = []
        for child_id in node.children_call_ids:
            if child_id in subtree_removed:
                continue
            child = by_id.get(child_id)
            if not child:
                continue
            if child.type in blacklist:
                result.extend(_resolve_children(child_id))
            else:
                result.append(child_id)
        return result

    kept: list[NormalizedCall] = []
    for r in records:
        if r.call_id in subtree_removed:
            continue
        if r.type in blacklist:
            continue
        r.children_call_ids = _resolve_children(r.call_id)
        kept.append(r)

    return kept
