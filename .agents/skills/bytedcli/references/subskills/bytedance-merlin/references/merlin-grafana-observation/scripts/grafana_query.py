#!/usr/bin/env python3
"""Grafana OpenAPI 查询工具。

通过字节云 Grafana OpenAPI 获取看板结构、面板时序数据、截图。
认证使用 merlin-cli SSO 登录后的 JWT token。

用法:
    python grafana_query.py describe --url "<dashboard_url>"
    python grafana_query.py panel-data --url "<dashboard_url>" --panel-id 138
    python grafana_query.py screenshot --url "<dashboard_url>" --panel-id 138 -o panel.png
    python grafana_query.py parse-vars --url "<dashboard_url_with_vars>"
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

# OpenAPI 网关地址
OPENAPI_BASE = "https://cloud.bytedance.net/api/v1/grafana_open_api"


def _load_jwt() -> str:
    """通过 merlin-cli 获取 JWT token（与其他 skill 保持一致，不直接读取 auth 文件）。"""
    try:
        result = subprocess.run(
            ["merlin-cli", "--control-plane", "cn-seed", "login", "get-jwt"],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode != 0:
            print(
                "错误：获取 JWT 失败，请执行: merlin-cli login --control-plane cn-seed --oauth2 --force",
                file=sys.stderr,
            )
            sys.exit(1)
        stdout = result.stdout.strip()
        if not stdout:
            print("错误：JWT 为空，请重新登录 merlin-cli", file=sys.stderr)
            sys.exit(1)
        # merlin-cli get-jwt 返回 JSON: {"jwt_token": "...", "success": true}
        try:
            data = json.loads(stdout)
            token = data.get("jwt_token", "")
        except json.JSONDecodeError:
            token = stdout
        if not token:
            print("错误：JWT 为空，请重新登录 merlin-cli", file=sys.stderr)
            sys.exit(1)
        return token
    except FileNotFoundError:
        print("错误：找不到 merlin-cli，请先安装", file=sys.stderr)
        sys.exit(1)


def _post(endpoint: str, body: dict, jwt: str, binary: bool = False) -> dict | bytes:
    """向 Grafana OpenAPI 发送 POST 请求。"""
    url = f"{OPENAPI_BASE}/{endpoint}"
    payload = json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "X-JWT-Token": jwt,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read()
            if binary:
                return raw
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        body_text = e.read().decode(errors="replace")[:500]
        print(f"HTTP {e.code}: {body_text}", file=sys.stderr)
        sys.exit(1)


def _inject_panel_id(dashboard_url: str, panel_id: int) -> str:
    """在 Dashboard URL 中注入 viewPanel 参数。"""
    parsed = urlparse(dashboard_url)
    qs = parse_qs(parsed.query)
    qs["viewPanel"] = [str(panel_id)]
    new_query = urlencode(qs, doseq=True)
    return urlunparse(parsed._replace(query=new_query))


def cmd_describe(args: argparse.Namespace) -> None:
    """获取 Dashboard 结构描述。"""
    jwt = _load_jwt()
    result = _post("dashboards/description", {"url": args.url}, jwt)

    # 提取 panel 摘要
    dashboards = result.get("dashboards", [])
    for db in dashboards:
        print(f"\n看板: {db.get('dashboard_title', 'N/A')} (UID: {db.get('dashboard_uid', 'N/A')})")
        for row in db.get("dashboard_panels", []):
            row_title = row.get("row_title", "Ungrouped")
            print(f"\n  ┌─ {row_title}")
            for panel in row.get("panels", []):
                pid = panel.get("id", "?")
                title = panel.get("title", "N/A")
                ptype = panel.get("type", "N/A")
                target_count = len(panel.get("targets", []))
                print(f"  │  [{pid}] {title} ({ptype}, {target_count} targets)")
            print("  └─")

    # 完整 JSON 输出到 stdout 便于程序处理
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))


def cmd_panel_data(args: argparse.Namespace) -> None:
    """获取 Panel 结构化时序数据。"""
    jwt = _load_jwt()
    panel_url = _inject_panel_id(args.url, args.panel_id)
    result = _post("screenshot", {"url": panel_url, "only_data": True}, jwt)

    total = result.get("total", [])
    if not total:
        print("未返回数据，请检查 URL 和时间范围", file=sys.stderr)
        sys.exit(1)

    for idx, group in enumerate(total):
        series_list = group.get("data", [])
        print(f"\n数据组 {idx}: {len(series_list)} 条时间序列")
        for s in series_list:
            metric = s.get("metric", "N/A")
            tags = s.get("tags", {})
            dps = s.get("dps", {})
            tag_str = ", ".join(f"{k}={v}" for k, v in tags.items())
            print(f"  metric={metric}  tags=[{tag_str}]  点数={len(dps)}")

            # 显示最近几个数据点
            if dps:
                sorted_dps = sorted(dps.items(), key=lambda x: int(x[0]))
                recent = sorted_dps[-3:] if len(sorted_dps) > 3 else sorted_dps
                for ts, val in recent:
                    print(f"    ts={ts}  val={val}")

    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))


def cmd_screenshot(args: argparse.Namespace) -> None:
    """获取 Panel 截图。"""
    jwt = _load_jwt()
    panel_url = _inject_panel_id(args.url, args.panel_id)
    body: dict = {"url": panel_url}
    if args.width:
        body["width"] = args.width
    if args.height:
        body["height"] = args.height

    raw = _post("screenshot", body, jwt, binary=True)
    output = Path(args.output)
    output.write_bytes(raw)
    print(f"截图已保存: {output} ({len(raw)} bytes)")


def cmd_parse_vars(args: argparse.Namespace) -> None:
    """解析看板模板变量。"""
    jwt = _load_jwt()
    result = _post("expr/parse", {"url": args.url}, jwt)
    print(json.dumps(result, indent=2, ensure_ascii=False))


def main() -> None:
    """命令行入口。"""
    parser = argparse.ArgumentParser(description="Grafana OpenAPI 查询工具")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # describe
    p_describe = subparsers.add_parser("describe", help="获取看板结构")
    p_describe.add_argument("--url", required=True, help="Grafana Dashboard URL")
    p_describe.add_argument("--json", action="store_true", help="输出完整 JSON")
    p_describe.set_defaults(func=cmd_describe)

    # panel-data
    p_data = subparsers.add_parser("panel-data", help="获取 Panel 时序数据")
    p_data.add_argument("--url", required=True, help="Grafana Dashboard URL")
    p_data.add_argument("--panel-id", type=int, required=True, help="Panel ID")
    p_data.add_argument("--json", action="store_true", help="输出完整 JSON")
    p_data.set_defaults(func=cmd_panel_data)

    # screenshot
    p_ss = subparsers.add_parser("screenshot", help="获取 Panel 截图")
    p_ss.add_argument("--url", required=True, help="Grafana Dashboard URL")
    p_ss.add_argument("--panel-id", type=int, required=True, help="Panel ID")
    p_ss.add_argument("-o", "--output", default="panel.png", help="输出文件路径")
    p_ss.add_argument("--width", type=int, default=1920, help="图片宽度")
    p_ss.add_argument("--height", type=int, default=1080, help="图片高度")
    p_ss.set_defaults(func=cmd_screenshot)

    # parse-vars
    p_vars = subparsers.add_parser("parse-vars", help="解析看板模板变量")
    p_vars.add_argument("--url", required=True, help="Grafana Dashboard URL（带变量参数）")
    p_vars.set_defaults(func=cmd_parse_vars)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
