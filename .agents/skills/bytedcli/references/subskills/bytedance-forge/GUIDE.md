---
name: bytedance-forge
description: "Access ByteDance Reckon Forge model platform via bytedcli: fetch task logs (`forge logs`), inspect job summaries / latest stage / step status (`forge job get`, `forge details`, `forge stages`), and compute file-level code diffs between two Forge model commits (`forge commit diff`). Use when tasks mention Forge, Reckon Forge, model commit diff, train log, sail/lagrange model, predict_sa_cvr_sail, or any URL under `reckon-ttp.tiktok-row.net/forge2`."
---

# Forge — Reckon Forge Model Platform

## 如何调用 bytedcli

先选择一种调用方式。下面所有示例默认直接写 `bytedcli`。

```bash
# 方式 1：直接用 npx 运行最新版
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]

# 方式 2：先全局安装，再直接调用 bytedcli
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli <command> [options]
```

- 使用 `npx` 时，把后文示例里的 `bytedcli` 替换成 `NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest`
- 已全局安装时，直接按后文示例执行 `bytedcli ...`

## When to use

- 拉 Forge 训练任务日志（HTML / JSON 两路 fallback）
- 查看 Forge job 概要、最新 stage、步骤状态
- 比对两个 Forge commit 的代码差异（按文件维度生成 unified diff）

## 前置条件

- 需要本机已经登录：`bytedcli auth login`
- 大部分接口走 ByteCloud JWT；commit/code 接口走相同 JWT

## 子命令一览

| 子命令 | 用途 |
| --- | --- |
| `bytedcli forge logs` | 拉训练日志，支持 `--site`、`--url`、`--job-id`、`--offset`、`--limit`、`--raw` |
| `bytedcli forge job get` | 任务概要 + stage 列表（首选；`forge details` / `forge stages` 已隐藏保留） |
| `bytedcli forge commit diff` | 比对两个 commit 的代码改动，生成文件级 unified diff |

## Logs

最常用的 3 种用法：

```bash
# 直接给 logs 页面 URL
bytedcli forge logs --url "https://reckon-ttp.tiktok-row.net/forge2/jobs/1315296/logs"

# 给 job-id + 站点（推荐）
bytedcli forge logs --job-id 1315296 --site us-ttp

# 拿 raw response（debug 用）
bytedcli forge logs --job-id 1315296 --site us-ttp --raw
```

常用参数：

- `--offset <n>`：默认 `-1`（从末尾开始），早期日志可用 `--offset 0`
- `--limit <n>`：默认 `500`
- 输出 `--json` 时，`data.logs` 是字符串

## Job summary

```bash
bytedcli forge job get --job-id 1315296
# 或
bytedcli forge job get --url "https://reckon-ttp.tiktok-row.net/forge2/jobs/1315296"

# 调试 raw 数据
bytedcli --json forge job get --job-id 1315296 --raw
```

输出包含：`job_id`、`tracing_base_url`、最新 stage / status、stage 列表（默认 page=0, page_size=10）。

## Commit diff（重点）

Forge UI 的代码 diff 页面（`/forge2/commits/<base>?target_commit_id=<target>`）实际上由 **两个后端接口** 拼起来 —— UI 自己在浏览器里做 diff 渲染，没有单独的 "diff API"。

`forge commit diff` 把这条链路自动化：

1. `GET /api/v2/forge/get_commit?id=<commit_id>&with_code=0` 拿 commit 元数据（含 `global_id`、`region`）
2. `GET /api/v1/global_site/get_commit_code?region=<region>&global_commit_id=<global_id>` 拿真正的代码 snapshot（`treeView` + `codeMap`）
3. 在本地按 **repo-relative path** 关联两个 commit 的文件，分类为 `added`/`removed`/`modified`/`unchanged`，对修改的文件生成 unified diff

### Quick Examples

```bash
# 直接给 UI 上的完整 diff URL（最省事）
bytedcli forge commit diff \
  --url "https://reckon-ttp.tiktok-row.net/forge2/commits/885953?target_commit_id=894613"

# 显式给 base + target
bytedcli forge commit diff --base 885953 --target 894613

# 拿机器可读 JSON（含 summary + per-file diff 文本）
bytedcli --json forge commit diff --base 885953 --target 894613

# 调试：保留 raw API payload
bytedcli --json forge commit diff --base 885953 --target 894613 --raw
```

### 输出结构（JSON 模式）

```jsonc
{
  "data": {
    "base":   { "id": 885953, "global_id": 2799458470, "region": "ttp", "version": 1064, ... },
    "target": { "id": 894613, "global_id": 1107921825, "region": "ttp", "version": 1065, ... },
    "region": "ttp",
    "context_lines": 3,
    "summary": {
      "files_total": 4, "files_added": 1, "files_removed": 1,
      "files_modified": 1, "files_unchanged": 1,
      "added_lines": 12, "removed_lines": 8
    },
    "files": [
      {
        "path": "models/feature.py",
        "status": "modified",
        "base_file_id": 1066135124,
        "target_file_id": -1046351223,
        "base_sha256": "...",
        "target_sha256": "...",
        "added_lines": 5,
        "removed_lines": 3,
        "diff": "--- commit/885953/models/feature.py\n+++ commit/894613/models/feature.py\n@@ -1,3 +1,5 @@\n ..."
      }
    ]
  }
}
```

文件配对策略是「按 path 关联」，因为同一文件在不同 commit 里 `treeView.id` 会变。

### 常用选项

- `--region <region>`：默认从 `get_commit` 返回的 `region` 推断（一般 `ttp`），跨区域时显式指定
- `--context-lines <n>`：unified diff 上下文行数，默认 3
- `--api-base-url <url>` / `--global-site-base-url <url>` / `--ui-base-url <url>`：低层 host 覆盖，主要给非 TTP 区域或本地代理使用
- `--raw`：在 JSON 输出里附 `raw_base_commit` / `raw_target_commit` / `raw_base_code` / `raw_target_code`

## Troubleshooting

- **`FORGE_AUTH_REQUIRED`**：先跑 `bytedcli auth login`；JWT 过期、刚切换 site 时常见
- **`FORGE_COMMIT_API_ERROR (code=4005)`** 或类似 `非办公网`：换办公网 / Lynx 代理重试
- **`FORGE_COMMIT_SCHEMA_ERROR: get_commit response missing global_id`**：通常说明 commit 不存在或被删；先用 `bytedcli forge job get` 校验 commit 所属 job 是否还活着
- 若 `code_snippet` 为空：检查 `get_commit_code` 是否被 region 错配（例如把 `va` commit 用 `ttp` 拉），可显式指定 `--region`

## Notes

- 缺少必填参数会输出完整帮助信息
- 需要机器可读输出时加 `--json`
- `--json` 是全局参数，必须放在子命令前，例如 `bytedcli --json forge commit diff --base ...`
- 需要排查具体请求链路时，优先使用全局参数 `--http-debug`；可配合 `--http-trace-file <path>` 把 trace 落盘
