---
name: bytedance-lark-gateway
description: "Operate Lark Gateway (lgw-console) via bytedcli: project / service / plugin (method + package) / IDL / config diff / deploy (12 commands) / rollback. All write operations default to dry-run and require --execute + --yes-i-know-this-is-live. Use when tasks mention 网关, Lark Gateway, lgw, lgw-console, 接口插件, plugin method, plugin package, IDL 导入, 网关发布, 网关回滚, 服务接入, PSM 注册 (within a gateway project), deploy lifecycle (checklist / check / status / process / approve / confirm / skip / cancel / csrf-escape), or snapshot/config diff."
---

# bytedcli Lark Gateway

`bytedcli lark-devops gateway` covers the full Lark Gateway (`lgw-console`) console lifecycle:

1. **Project management** — list / get / star / unstar favorites in a gateway target env.
2. **Service (PSM) management** — list registered services, view a single service, add a new PSM to a project.
3. **Plugin management** — method-level plugin attach/detach + package-level bind/unbind/impact analysis.
4. **IDL import** — list versions/methods + import from Codebase with `overwrite` / `increase` strategy.
5. **Diff** — view config diff (current vs online/snapshot/deployment) and snapshot-to-snapshot diff.
6. **Deploy** — full deploy lifecycle: list/checklist/check/status/process/csrf-reasons (read); create/approve/confirm/skip/cancel/csrf-escape (write, dry-run gated).
7. **Rollback** — create a rollback for a deployment (dry-run gated).

All write operations default to **dry-run**. Real writes require `--execute --yes-i-know-this-is-live` together.

## How to call bytedcli

```bash
# Option 1: run latest via npx
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]

# Option 2: install globally once, then call bytedcli directly
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli <command> [options]
```

All subcommands accept `-j` / `--json` (global flag, placed BEFORE the subcommand) to emit structured JSON for Agent consumption.

> HTTP proxy: if your shell sets `http_proxy` / `https_proxy` for other reasons, unset them when calling bytedcli against internal endpoints, e.g. `env -u http_proxy -u https_proxy bytedcli ...`.

## When to use

- 查询 / 管理 gateway project (favorites, service registration, plugin config, IDL, deploy, rollback)
- AI Agent 常见场景：
  - 从一个 method 复制插件配置到新的 method
  - 批量把 plugin package 绑定到一组 method
  - 跑完 IDL 改动后一把 preview → import 到目标 env
  - dry-run preview `deploy create` / `rollback create` payload，人工确认后再 `--execute`

## 前置条件

- 已登录 Lark Devops session：
  - 最稳的路径是在本机 Chrome 浏览器登录 `https://lark-devops.bytedance.net`，bytedcli 会自动从 Chromium cookie 库提取 `beops_session`；失败时再用 `bytedcli auth login --session` 补一份 SSO session 兜底
  - 写操作还需要同一会话里的 `_csrf_token` cookie（CLI 自动读取）
- 6 个网关目标环境枚举值（对应 `/page/gateway/<env>` URL 前缀）：`boe-cn`, `boe-i18n`, `pre-cn`, `pre-i18n`, `prod-cn`, `prod-i18n`；未指定 `--gateway-env` 时默认 `boe-cn`
- `--gateway-env` 是每个叶子命令的 option，不会在 parent 上继承

## Quick start

```bash
# 1. 收藏项目 + 看服务列表
bytedcli --json lark-devops gateway project list --keyword demo --gateway-env boe-cn
bytedcli --json lark-devops gateway service list --project-id 123 --gateway-env boe-cn

# 2. 插件操作（dry-run → live）
bytedcli lark-devops gateway plugin method list \
  --project-id 123 --psm example.service.api --gateway-env boe-cn

bytedcli lark-devops gateway plugin method add \
  --project-id 123 --method-id 7 --plugin-id 42 \
  --plugin-name rate-limit \
  --config '[{"name":"qps","value":100}]' \
  --gateway-env boe-cn \
  --execute --yes-i-know-this-is-live

# 3. 发布 + 轮询
bytedcli lark-devops gateway deploy create \
  --project-id 123 --mode current --remark "v1" \
  --gateway-env boe-cn \
  --execute --yes-i-know-this-is-live

bytedcli lark-devops gateway deploy status \
  --project-id 123 --deploy-id 7 --gateway-env boe-cn --watch

# 4. 查询 IDL 版本
bytedcli --json lark-devops gateway idl versions \
  --project-id 123 --psm example.service.api --gateway-env boe-cn
```

## Notes

- **所有写操作默认 dry-run**。Dry-run 输出 `{mode:"dry-run", method, url, body}`，不发真实请求；live 需 `--execute --yes-i-know-this-is-live` 两个 flag 一起给，缺一个则 exit 2 (`LARK_DEVOPS_GATEWAY_LIVE_WRITE_REFUSED`)。
- `--json` 是全局 option，必须放在子命令前（`bytedcli --json lark-devops gateway ...`，不是 `... --json`）。
- JSON 输出字段是 **snake_case**，对列表命令返回 `{ items, total? }`，对单项返回 `{ data }`。
- **`deploy status --watch` 超时不算错**：默认 interval 3s、timeout 10min。超时输出 `{status:"pending", job_id, progress, retry_hint}`，exit 0。终态 `success` exit 0、`failed` / `cancelled` exit 1。
- **`plugin package detail`** 在 CLI 里主命令名是 `get`，保留 `detail` 作为 alias 兼容。
- **`idl import` 策略**是 `overwrite` 或 `increase`（与 Python 源保真；注意不是 `incremental`）。
- **错误码前缀**：`LARK_DEVOPS_GATEWAY_*`（避免与 `bytedance-agw` 的 API Gateway 错误码混淆）。
- 写操作统一 dry-run JSON envelope：`{mode:"dry-run", url, method, body}` 或 live: `{mode:"live", ...}`。

## Command tree (33 commands)

```
bytedcli lark-devops gateway
├── project     (list / get / star / unstar)
├── service     (list / get / add)
├── plugin
│   ├── method   (list / add / delete)
│   └── package  (list / get|detail / impact / bind / unbind)
├── idl         (versions / methods / import)
├── diff        (config / snapshot)
├── deploy      (list / checklist / check / status [--watch] / process /
│                csrf-reasons / create / approve / confirm / skip /
│                cancel / csrf-escape)
└── rollback    (create)
```

## References

- [Project](references/project.md) — project list/get/star/unstar
- [Deploy](references/deploy.md) — full deploy lifecycle (12 commands) + rollback + watchDeploy contract
- [Plugin](references/plugin.md) — plugin method + package; plugin-copy workflow
- [IDL](references/idl.md) — IDL versions/methods/import (overwrite|increase)
- [Workflow](references/workflow.md) — register service → config methods → install plugins → dry-run deploy → live deploy → watch
