#!/usr/bin/env python3
"""
Arena exercise 进度轮询脚本。

通过多次快照对比，检测哪些 exercise 卡住 / 正常推进 / 尾部卡住，
输出结构化的进度报告（含 Δ 值、类型识别、ETA 估算）。

用法:
    python3 poll_exercise_progress.py --eval-sid <evaluation_task_sid> [--interval 60] [--snapshots 2]
    python3 poll_exercise_progress.py --arena-url "https://seed.bytedance.net/evaluation/arena/xxx?evaluation_task_sid=yyy"
"""

import argparse
import json
import re
import subprocess
import sys
import time
from urllib.parse import parse_qs, urlparse

# exercise 名称 → 类型的关键词匹配规则（按优先级排列）
TYPE_RULES = [
    (r"streaming.*fps|streaming_fps", "streaming 多轮"),
    (r"crawl", "爬虫 API (限速)"),
    (r"multiturn|trajectory|agent|swalm", "多轮推理"),
    (r"hour|Hour|longvideo|timelens", "长视频"),
    (r"10fps", "高帧率视频 (10fps)"),
    (r"5fps", "高帧率视频 (5fps)"),
    (r"fps|video|Video|camera|Camera", "视频"),
    (r"speech|audio|voice", "音频"),
]


def parse_eval_sid(url_or_sid: str) -> str:
    """从 Arena URL 或纯 sid 中提取 evaluation_task_sid。"""
    if url_or_sid.startswith("http"):
        parsed = urlparse(url_or_sid)
        qs = parse_qs(parsed.query)
        if "evaluation_task_sid" in qs:
            return qs["evaluation_task_sid"][0]
        # fallback: URL path 末段
        return parsed.path.rstrip("/").split("/")[-1]
    return url_or_sid


def get_evaluation(eval_sid: str) -> dict:
    """调用 merlin-cli arena get-evaluation，返回解析后的 JSON。"""
    result = subprocess.run(
        [
            "merlin-cli", "--control-plane", "cn-seed",
            "arena", "get-evaluation",
            "--json", json.dumps({"sid": eval_sid}),
        ],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode != 0:
        print(f"ERROR: merlin-cli 调用失败 (exit={result.returncode})", file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        sys.exit(1)
    return json.loads(result.stdout)


def classify_exercise(name: str) -> str:
    """根据名称关键词推断 exercise 工作负载类型。"""
    for pattern, label in TYPE_RULES:
        if re.search(pattern, name, re.IGNORECASE):
            return label
    return "文本/图片"


def extract_progress(data: dict) -> tuple[dict, dict, int]:
    """从 get-evaluation 返回中提取 exercise 明细和汇总信息。

    Returns:
        (detail_dict, exercise_progress, need_run_total)
    """
    ae = data.get("arena_evaluation", {})
    detail = ae.get("progress", {}).get("detail", {})
    ep = ae.get("exercise_progress", {})
    total = ae.get("progress", {}).get("need_run_total", 0)
    completed = ae.get("progress", {}).get("completed", 0)
    return detail, ep, total, completed


def take_snapshot(eval_sid: str) -> dict:
    """获取一次快照，返回 {exercise_name: (completed, total)} 和汇总信息。"""
    data = get_evaluation(eval_sid)
    detail, ep, need_run_total, instance_completed = extract_progress(data)
    snap = {}
    for name, info in detail.items():
        snap[name] = (info.get("completed", 0), info.get("total", 0))
    return {
        "exercises": snap,
        "exercise_progress": ep,
        "need_run_total": need_run_total,
        "instance_completed": instance_completed,
        "timestamp": time.time(),
    }


def compare_snapshots(snap1: dict, snap2: dict) -> list[dict]:
    """对比两次快照，生成每个 exercise 的诊断结果。"""
    results = []
    dt = snap2["timestamp"] - snap1["timestamp"]
    dt_min = dt / 60 if dt > 0 else 1

    for name in sorted(snap2["exercises"].keys()):
        c2, total = snap2["exercises"][name]
        c1 = snap1["exercises"].get(name, (0, total))[0]
        delta = c2 - c1
        pct = round(c2 / total * 100, 1) if total > 0 else 0
        remaining = total - c2
        ex_type = classify_exercise(name)
        rate = delta / dt_min if dt_min > 0 else 0

        if c2 == total and c2 > 0:
            status = "已完成"
            symbol = "✓"
        elif delta > 0:
            status = "正常推进"
            symbol = "✓"
        elif c2 > 0 and pct > 90:
            status = "尾部卡住"
            symbol = "✗"
        elif c2 > 0 and delta == 0:
            status = "卡住"
            symbol = "✗"
        else:
            status = "未开始"
            symbol = "○"

        results.append({
            "name": name,
            "completed_before": c1,
            "completed_after": c2,
            "total": total,
            "pct": pct,
            "delta": delta,
            "rate": round(rate, 1),
            "remaining": remaining,
            "status": status,
            "symbol": symbol,
            "type": ex_type,
        })
    return results


def print_report(results: list[dict], snap: dict, interval: int):
    """输出结构化的进度报告。"""
    stuck = [r for r in results if r["status"] in ("卡住", "尾部卡住")]
    progressing = [r for r in results if r["status"] == "正常推进"]
    completed = [r for r in results if r["status"] == "已完成"]
    not_started = [r for r in results if r["status"] == "未开始"]

    ep = snap["exercise_progress"]
    print(f"## Exercise 进度轮询（间隔 {interval}s）\n")
    print(f"Exercise 汇总: completed={ep.get('completed', '?')}, "
          f"running={ep.get('running', '?')}, "
          f"not_started={ep.get('not_started', '?')}, "
          f"total={ep.get('total', '?')}")
    print(f"Instance 汇总: {snap['instance_completed']}/{snap['need_run_total']}\n")

    # 分组输出
    if stuck:
        print(f"### 卡住 / 尾部卡住（{len(stuck)} 个）\n")
        for r in sorted(stuck, key=lambda x: -x["pct"]):
            tail_info = f" [{r['remaining']} instances 剩余]" if r["status"] == "尾部卡住" else ""
            print(f"  {r['symbol']} {r['name']}: "
                  f"{r['completed_before']}→{r['completed_after']}/{r['total']} "
                  f"({r['pct']}%) Δ={r['delta']} — **{r['status']}**{tail_info} "
                  f"[{r['type']}]")
        print()

    if progressing:
        print(f"### 正常推进（{len(progressing)} 个）\n")
        for r in sorted(progressing, key=lambda x: -x["rate"]):
            print(f"  {r['symbol']} {r['name']}: "
                  f"{r['completed_before']}→{r['completed_after']}/{r['total']} "
                  f"({r['pct']}%) Δ={r['delta']}/min — 正常 [{r['type']}]")
        print()

    if completed:
        print(f"### 已完成（{len(completed)} 个）\n")
        for r in completed:
            print(f"  {r['symbol']} {r['name']}: {r['total']}/{r['total']}")
        print()

    if not_started:
        print(f"### 未开始（{len(not_started)} 个）\n")
        total_pending = sum(r["total"] for r in not_started)
        heavy = [r for r in not_started if r["type"] not in ("文本/图片",)]
        print(f"  共 {len(not_started)} 个 exercise, {total_pending} instances")
        if heavy:
            print(f"  其中重负载 exercise: {', '.join(r['name'].split('#')[0] + ' [' + r['type'] + ']' for r in heavy[:5])}")
            if len(heavy) > 5:
                print(f"  ... 及其他 {len(heavy) - 5} 个")
        print()

    # ETA 估算
    total_rate = sum(r["rate"] for r in progressing)
    total_remaining = snap["need_run_total"] - snap["instance_completed"]
    print("### ETA 估算\n")
    if total_rate > 0:
        eta_hours = total_remaining / total_rate / 60
        print(f"  当前活跃速率: ~{total_rate:.1f} instances/min")
        print(f"  剩余: {total_remaining} instances")
        print(f"  预计: ~{eta_hours:.1f} 小时")
        if stuck:
            print(f"  ⚠ 注意: {len(stuck)} 个卡住 exercise 占据 running 槽位，"
                  f"阻塞 {len(not_started)} 个未开始 exercise，实际可能更久")
    else:
        print(f"  ⚠ 当前无活跃推进的 exercise，无法估算 ETA")
        print(f"  剩余: {total_remaining} instances")
    print()

    # 结论
    print("### 结论\n")
    if stuck:
        stuck_names = ", ".join(r["name"].split("#")[0] for r in stuck[:4])
        if len(stuck) > 4:
            stuck_names += f" 等 {len(stuck)} 个"
        print(f"  {len(stuck)}/{len(stuck) + len(progressing)} running exercise 卡住 "
              f"({stuck_names})，阻塞 {len(not_started)} 个 not_started exercise")
    elif progressing:
        print(f"  所有 running exercise 正常推进，无卡住现象")
    else:
        print(f"  无 running exercise（全部已完成或未开始）")


def main():
    parser = argparse.ArgumentParser(description="Arena exercise 进度轮询")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--eval-sid", help="evaluation_task_sid")
    group.add_argument("--arena-url", help="Arena URL (自动解析 evaluation_task_sid)")
    parser.add_argument("--interval", type=int, default=60,
                        help="两次快照的间隔秒数 (默认 60)")
    parser.add_argument("--snapshots", type=int, default=2,
                        help="快照次数 (默认 2，即 1 次对比)")
    parser.add_argument("--json-output", action="store_true",
                        help="输出 JSON 格式（供程序化消费）")
    args = parser.parse_args()

    eval_sid = args.eval_sid or parse_eval_sid(args.arena_url)
    print(f"[poll] evaluation_task_sid = {eval_sid}")
    print(f"[poll] 间隔 = {args.interval}s, 快照次数 = {args.snapshots}\n")

    snapshots = []
    for i in range(args.snapshots):
        ts = time.strftime("%H:%M:%S")
        print(f"[poll] 第 {i + 1}/{args.snapshots} 次快照 ({ts})...")
        snap = take_snapshot(eval_sid)
        snapshots.append(snap)
        if i < args.snapshots - 1:
            print(f"[poll] 等待 {args.interval}s...\n")
            time.sleep(args.interval)

    results = compare_snapshots(snapshots[0], snapshots[-1])

    if args.json_output:
        output = {
            "eval_sid": eval_sid,
            "interval_s": args.interval,
            "snapshot_count": args.snapshots,
            "exercises": results,
            "summary": {
                "stuck": len([r for r in results if r["status"] in ("卡住", "尾部卡住")]),
                "progressing": len([r for r in results if r["status"] == "正常推进"]),
                "completed": len([r for r in results if r["status"] == "已完成"]),
                "not_started": len([r for r in results if r["status"] == "未开始"]),
            },
        }
        print(json.dumps(output, indent=2, ensure_ascii=False))
    else:
        print()
        print_report(results, snapshots[-1], args.interval)


if __name__ == "__main__":
    main()
