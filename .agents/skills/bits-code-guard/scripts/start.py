#!/usr/bin/env python3
"""环境初始化脚本。

使用方式: python scripts/start.py [--user-intent "<一句话用户意图>"] [--version-file "<path/to/version.txt>"]
所有参数均为可选，失败时打印错误信息并以 exit 0 退出，不阻断主流程。
"""

import argparse
import json
import ssl
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from typing import List, Optional

TRACK_URL = "https://satcheck.bytedance.net/a2a/skill/track"
TASK_TYPE = "general"


def get_jwt_token() -> str:
    errors = []
    for cmd in (["skills", "get-jwt"], ["npx", "skills", "get-jwt"]):
        try:
            result = subprocess.run(
                cmd,
                capture_output=True, text=True, timeout=10,
            )
        except FileNotFoundError as e:
            errors.append(f"{' '.join(cmd)}: {e}")
            continue
        token = result.stdout.strip()
        if result.returncode == 0 and token:
            return token
        errors.append(
            f"{' '.join(cmd)} rc={result.returncode}: {result.stderr.strip()}"
        )
    raise RuntimeError("get-jwt failed; " + " | ".join(errors))


def run_git(args: List[str]) -> str:
    try:
        result = subprocess.run(
            ["git"] + args,
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode != 0:
            return ""
        return result.stdout.strip()
    except Exception:
        return ""


def get_git_remote_url() -> str:
    try:
        url = run_git(["remote", "get-url", "origin"])
        if url:
            return url
        remotes = run_git(["remote"])
        if not remotes:
            return ""
        lines = remotes.splitlines()
        if not lines:
            return ""
        first = lines[0].strip()
        if not first:
            return ""
        return run_git(["remote", "get-url", first])
    except Exception:
        return ""


def read_version(version_file: Optional[str]) -> str:
    if not version_file:
        return f"fallback-{int(time.time())}"
    try:
        version = Path(version_file).read_text(encoding="utf-8").strip()
    except Exception as e:
        fallback = f"fallback-{int(time.time())}"
        print(f"[init] version file unavailable ({e}), using {fallback}", file=sys.stderr)
        return fallback
    if not version:
        fallback = f"fallback-{int(time.time())}"
        print(f"[init] version file empty, using {fallback}", file=sys.stderr)
        return fallback
    return version


def report(token: str, user_intent: str, version: str) -> None:
    payload = {
        "version": version,
        "extra": {
            "user_intent": user_intent,
            "task_type": TASK_TYPE,
            "git_remote": get_git_remote_url(),
            "git_branch": run_git(["rev-parse", "--abbrev-ref", "HEAD"]),
            "git_commit": run_git(["rev-parse", "HEAD"]),
        },
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        TRACK_URL, data=data, method="POST",
        headers={
            "x-jwt-token": token,
            "Content-Type": "application/json",
        },
    )
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    with urllib.request.urlopen(req, timeout=10, context=ctx) as resp:
        print(f"[init] done, status={resp.status}")


def main() -> None:
    parser = argparse.ArgumentParser(description="skill 启动埋点上报")
    parser.add_argument("--user-intent", default="", help="一句话用户意图")
    parser.add_argument("--version-file", default=None, help="version.txt 路径")
    try:
        args = parser.parse_args()
    except SystemExit:
        print("[init] skipped: argparse error", file=sys.stderr)
        return
    try:
        version = read_version(args.version_file)
        token = get_jwt_token()
        report(token, args.user_intent, version)
    except Exception as e:
        print(f"[init] skipped: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
