---
name: bytedance-tiktok-gecko
description: "Use bytedcli tiktok-gecko commands to query TikTok Gecko resources (workbench, app, channel, ticket, host-app, deployment, deployment-channel, channel package, online package), and to perform write operations: release create, package online rollback, and ticket cancel/retry/execute. Trigger this skill whenever the user asks to inspect Gecko console data, list or get Gecko resources, filter Gecko tickets, troubleshoot Gecko IDs/regions, create a Gecko release, roll back a live online package, or cancel/retry/execute a Gecko ticket from the CLI."
---

# bytedcli TikTok Gecko

## 如何调用 bytedcli

本 skill 支持 TikTok ROW (prod) 与 TikTok BOE i18n 两个站点，二选一即可：

```bash
# Prod (TikTok ROW)：默认推导 TikTok SSO
bytedcli --site i18n-tt --auth-site tiktok <command> [options]

# BOE i18n 分区：默认推导 bytedance SSO
bytedcli --site boe <command> [options]
```

- 支持 `--site`：`i18n-tt`（prod，host `tiktok-gecko-global.tiktok-row.net`）、`boe`（BOE i18n 分区，host `tiktok-gecko-global-boei18n.bytedance.net`）。
- 其它站点（`cn` / `i18n-bd` / `eu-ttp` 等）会被入口直接拒绝，错误码 `TIKTOK_GECKO_SITE_AUTH_MISMATCH`。
- `--auth-site` 通常无需显式传入：`i18n-tt` 默认推导 `tiktok`，`boe` 默认推导 `bytedance`。**不要**在 `i18n-tt` 上显式传 `--auth-site bytedance`，也**不要**在 `boe` 上显式传 `--auth-site tiktok`，会被入口校验拒绝。
- 使用 `npx` 时，把后文示例里的 `bytedcli` 替换成 `NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest`
- 已全局安装时，直接按后文示例执行 `bytedcli ...`

### 站点对照表（site → host / SSO / JWT issuer）

| `--site` | Backend host | SSO | JWT issuer | 隐式 vregion |
| --- | --- | --- | --- | --- |
| `i18n-tt` | `https://tiktok-gecko-global.tiktok-row.net` | `tiktok` | `cloud.tiktok-row.net` | （无须） |
| `boe` | `https://tiktok-gecko-global-boei18n.bytedance.net` | `bytedance` | `cloud.bytedance.net` | `boei18n`（CLI 自动注入，无需手动 `--vregion`） |

后文示例统一以 `--site i18n-tt --auth-site tiktok` 写出；要打到 BOE，直接把这两个 flag 替换成 `--site boe`（auth-site 通常省略），其余参数完全一致。CLI 内部会按 `--site` 自动切换 base URL、JWT host 与 permission apply URL。

## When to use

- 查询 TikTok Gecko 工作台关注项和待处理工单
- 按名称或条件分页查询 Gecko App / Channel / Ticket / Host App
- 根据 ID 拉取单个 Gecko 资源详情（App、Channel、Ticket、Host App、Deployment）
- 查看 Deployment 下关联的 Channel 列表
- 需要基于 CLI 快速确认 Gecko 资源 ID、地域、状态或关联关系
- **写操作**：发起 Release（`release create`）、回滚线上包（`package online rollback`）、对工单取消 / 重试 / 执行（`ticket cancel/retry/execute`）

## 前置条件

- 建议先确认目标站点登录态可用：

```bash
# Prod
bytedcli --site i18n-tt --auth-site tiktok auth status
# BOE i18n
bytedcli --site boe auth status
```

- 若未登录或 token 失效，先执行对应站点的 auth login：

```bash
# Prod 登录态走 TikTok SSO
bytedcli --site i18n-tt --auth-site tiktok auth login
# BOE 登录态走 bytedance SSO
bytedcli --site boe auth login
```

> Prod 与 BOE 使用不同 SSO，登录态彼此独立；切站点前确认对应站点的 token 仍有效。

## Quick start — 只读查询

> 后文示例统一写 prod (`--site i18n-tt --auth-site tiktok`)。要改打 BOE，直接把这两 flag 替换成 `--site boe`，命令其余部分不变。例如：
>
> ```bash
> bytedcli --site boe tiktok-gecko channel get --channel-id <id>
> bytedcli --site boe tiktok-gecko ticket get --ticket-id <id>
> ```

```bash
# 工作台概览（关注 Channel/App/Deployment + 待处理工单）
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko workbench get

# 列表查询
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko app list --page 1 --page-size 20
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko channel list --region row --name demo-channel
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko ticket list --creator demo.user --status pending
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko host-app list --keyword demo-app

# 详情查询（按 ID）
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko app get --app-id <app_id>
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko channel get --channel-id <channel_id>
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko ticket get --ticket-id <ticket_id>
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko host-app get --host-app-id <host_app_id>
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko deployment get --deployment-id <deployment_id>

# 等待工单跑到终态（内置 polling，--watch 模式；agent 不要再自己写 sleep loop）
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko ticket get --ticket-id <ticket_id> --watch --watch-interval 5 --watch-timeout 600

# 查询部署下的 Channel
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko deployment channel list --deployment-id <deployment_id> --type all

# 查询某个 Channel 下的资源包（推荐）
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko channel package list --channel-id-list <channel_id_a>,<channel_id_b> --creator-list demo.user

# 查询线上包列表（GET /gecko/api/channel/package-online/list）
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko package online list --channel-region-id <channel_region_id> --target-os 2 --page 1 --page-size 20

# 资源包高级过滤（与控制台 package-meta/list 参数对齐）
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko channel package list \
  --channel-id-list <channel_id_a>,<channel_id_b> \
  --region-list row,eu-ttp,us-ttp \
  --target-os-list 0,1,2,3,4,5,6 \
  --meta-package-id-list <meta_package_id> \
  --region-package-id-list <region_package_id> \
  --package-type-list 1,2 \
  --env-lane-list ppe \
  --creator-list demo.user \
  --page 1 --page-size 20
```

## Quick start — 写操作（含风险等级）

> **写操作不做客户端权限预检**：所有写命令直接发请求，由后端 `permission_service.checkCurrentUserPermission`（`@CheckPermission` AOP）裁决；权限被拒时 CLI 错误渲染层（`src/services/tiktok_gecko/error_render.ts`）会基于可选的 `--channel-id` 自动附上申请会员链接（host 也按 site 自动切换：prod 用 `tiktok-gecko-global.tiktok-row.net`、BOE 用 `tiktok-gecko-global-boei18n.bytedance.net`；缺 `--channel-id` 时降级到 `/gecko/site/v2` 首页）。详情见下方 "Permission denial 错误渲染（server-side single source of truth）" 小节。
>
> **写命令同样支持 `--site boe`**：把示例里的 `--site i18n-tt --auth-site tiktok` 替换成 `--site boe`，request body / risk gating / dry-run 流程完全一致；CLI 自动改写 base URL 与 permission apply URL。BOE 上的 channel id 与 prod 是不同的命名空间，**别复用 prod 的 channelId**——先在 BOE 上用 `--site boe tiktok-gecko channel list` 拿到对应 id 再继续。

### 1. In-house Release（low risk，agent 可直接执行）

```bash
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko release create \
  --channel-name demo-channel \
  --channel-id <channel_id> \
  --apply-type offline \
  --description 'fix demo bug' \
  --target-region row \
  --target-deployment-ak <ak> \
  --from-branch master --scm-repo my/repo \
  --target-os 2 --target-app-version 1.2.3 \
  --deployment-type in-house
```

- `--deployment-type in-house` 让 risk gating 判定为 low，可直接执行。
- 不传 `--deployment-type` 会被 fail-safe 判为 HIGH，需要 `--dry-run` + `--yes` 二段式。

### 2. Online Release（HIGH RISK，必须先 `--dry-run` 再 `--yes`）

```bash
# Step 1: 预览请求体，向用户展示
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko release create \
  --channel-name demo-channel \
  --channel-id <channel_id> \
  --apply-type offline+online \
  --description 'launch v2' \
  --target-region row \
  --target-deployment-ak <ak> \
  --from-scm-version 1.2.3 --scm-repo my/repo \
  --target-os 2 --target-app-version 1.2.3 \
  --online-issue-percent 100 --online-auto-start-release \
  --deployment-type online --dry-run

# Step 2: 用户明确同意后，agent 把同一条命令加 --yes 重新执行
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko release create \
  ... --channel-id <channel_id> --deployment-type online --yes
```

### 3. Online Package Rollback（ALWAYS HIGH RISK）

```bash
# Step 1: 预览（推荐传 --channel-id；CLI 不做客户端预检，但后端拒绝时会用它构造申请会员链接 deep-link）
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko package online rollback \
  --region row \
  --region-ticket-id <region_ticket_id> \
  --package-id <current_pkg_id> \
  --rollback-package-id <target_pkg_id> \
  --channel-id <channel_id> \
  --dry-run

# Step 2: 用户明确同意后，re-run with --yes
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko package online rollback \
  --region row \
  --region-ticket-id <region_ticket_id> \
  --package-id <current_pkg_id> \
  --rollback-package-id <target_pkg_id> \
  --channel-id <channel_id> \
  --yes
```

### 4. Ticket cancel / retry / execute

```bash
# 取消（low risk，可直接执行；推荐先 list/get 确认 ticket）
# --channel-id 可选；CLI 不做客户端预检，权限只由后端裁决，传上后只用于在被拒时构造申请会员链接（不传则 apply URL 降级为首页）
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko ticket cancel --ticket-id <ticket_id> --channel-id <channel_id>

# 重试（low risk）
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko ticket retry --ticket-id <ticket_id> --channel-id <channel_id>

# 在 in-house 工单上执行（low risk）
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko ticket execute --ticket-id <ticket_id> --channel-id <channel_id> --deployment-type in-house

# 在 online 工单上执行（HIGH RISK，必须先 --dry-run 再 --yes）
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko ticket execute --ticket-id <ticket_id> --channel-id <channel_id> --deployment-type online --dry-run
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko ticket execute --ticket-id <ticket_id> --channel-id <channel_id> --deployment-type online --yes

# 可选：限定到特定 region ticket（repeatable）
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko ticket cancel \
  --ticket-id <ticket_id> \
  --region-ticket row:rt_abc \
  --region-ticket eu-ttp:rt_def
```

`--region-ticket` 接收 `region:regionTicketId[:nodeId]` 格式，可重复传多个；不传则后端默认对所有满足条件的 region ticket 生效。

> 所有写命令的 `--channel-id` 都是**可选**的。它**不会**触发任何客户端预检——后端始终是权限的唯一可信源——CLI 仅在后端返回 `CHECK_PERMISSION_ERROR` 时用它来构造申请会员链接（deep-link）。

## Permission denial 错误渲染（server-side single source of truth）

CLI 不再做客户端权限预检。所有写命令直接发请求，由后端 `permission_service.checkCurrentUserPermission`（`@CheckPermission` AOP）裁决。被拒时后端返回 `ResponseCodeEnum.CHECK_PERMISSION_ERROR = 3` 的响应，CLI 客户端把它包装成：

```text
tiktok-gecko API error: [3] Permission denied in regions: row. Username: alice.doe, Resource: <channelName>, Url: https://...
```

**`src/services/tiktok_gecko/error_render.ts`** 在 service 层 `await` 每个写 API 时统一捕获并增强：

- 命中权限拒绝（`code === "TIKTOK_GECKO_ERROR"` + 含 `[3] ` / `permission denied` / `no permission` / `don't have permission`）时，重新抛出
  `AppError(code: "TIKTOK_GECKO_PERMISSION_DENIED")`，并附加 `hint`、`details.applyUrl`、`details.channelId`、`details.site`、`details.originalMessage`。
- message 在原文末尾追加单独一行 `Apply membership/role at: <applyUrl>`，避免被单行日志截断。
- 其他错误（输入校验、`SERVICE_ERROR=10000`、HTTP 4xx/5xx 等）原样透传，保持 stack trace 与实例不变。

申请入口 URL 模板（host 按 `--site` 自动切换；缺 `--channel-id` 时降级为 `/gecko/site/v2`）：

```text
# --site i18n-tt（默认）
https://tiktok-gecko-global.tiktok-row.net/gecko/site/v2/channel/<channelId>?moduleType=memberManagement
# --site boe
https://tiktok-gecko-global-boei18n.bytedance.net/gecko/site/v2/channel/<channelId>?moduleType=memberManagement
```

### 行为矩阵

| Action 入口 | `--channel-id` 默认行为 |
| --- | --- |
| `release.create` | 可选；缺省时 apply URL 降级为 `/gecko/site/v2` 首页 |
| `ticket.cancel/retry/execute` | 可选；ticket payload 本身不带 channel id，不传则 apply URL 降级为首页 |
| `package.online.rollback` | 可选；不传则 apply URL 降级为首页 |

### 设计决策

- **后端 = single source of truth**：CLI 不再额外打一次 `get-permissions-by-meta-resource`。`channel_master / channel_admin / channel_package_write / channel_approver` 等具体权限规则全部由后端 AOP 维护，避免客户端 / 服务端漂移。
- **god / 管理员账号** 走后端 `assignPermission=true` 通配自动放行，与 CLI 无关。
- **dry-run 不会触发权限校验**（因为根本不发请求）。如果担心 dry-run 看到 OK 但 `--yes` 被后端拒，就先用低风险或 in-house deployment 验证，或直接 `--yes` 并阅读错误。
- **错误结构化字段**（用于 `--json` 模式 / agent 编程消费）：
  ```json
  {
    "code": "TIKTOK_GECKO_PERMISSION_DENIED",
    "hint": "Apply membership / role on TikTok Gecko channel <channel_id>: https://...",
    "details": {
      "applyUrl": "https://tiktok-gecko-global.tiktok-row.net/gecko/site/v2/channel/<channel_id>?moduleType=memberManagement",
      "channelId": "<channel_id>",
      "site": "i18n-tt",
      "originalCode": "TIKTOK_GECKO_ERROR",
      "originalMessage": "tiktok-gecko API error: [3] Permission denied in regions: row. Username: ..."
    }
  }
  ```

## Stability Rules（MUST follow）

| 命令 | 默认风险 | 触发因素 |
| --- | --- | --- |
| `release create` | low | high 当 `--deployment-type online`；不传 `--deployment-type` 也 fail-safe 升 high |
| `package online rollback` | **HIGH（永远）** | always destructive，影响线上服务 |
| `ticket cancel` | low | — |
| `ticket retry` | low | — |
| `ticket execute` | low | high 当 `--deployment-type online`；不传 `--deployment-type` 也 fail-safe 升 high |

> Risk gating 与 `--site` 维度无关。`--site boe` 上的 high-risk 命令同样需要 `--dry-run` → 用户确认 → `--yes` 二段式；BOE 也是有真实流量的环境，不要因为名字带 BOE 就降级处理。

### `release create` 安全规则（MUST follow）

1. **online deployment 必须先 `--dry-run`**：把请求体（包括 SCM 源、target 列表、apply-types、issuePercent 等）完整展示给用户，等用户明确确认后才允许加 `--yes` 真正提交。
2. **不要默认带 `--yes` 静默执行**：即使是脚本场景，遇到 high risk 也要让用户先看 dry-run。
3. **不传 `--deployment-type` 会被强制视为 HIGH RISK**（fail-safe）；agent 在调用前应主动从上下文（如 `deployment get` 的 `typeName`）确认目标 deployment 的属性。

### `package online rollback` 安全规则（MUST follow）

1. **ALWAYS HIGH RISK**：无论 `--deployment-type` 是什么、无论目标 region 是哪一个，回滚都会立即影响线上服务，必须二次确认。
2. **必须先 `--dry-run`**：把 `region / region-ticket-id / package-id → rollback-package-id` 映射完整展示给用户，等用户确认后再加 `--yes`。
3. **每次只回滚单个 package**：CLI MVP 只支持 `--region` + 一组 `--package-id` / `--rollback-package-id`；不要在一条命令里编排多 region 多 package 的批量回滚——逐个串行执行，每次都重新预览 + 确认。
4. **`--package-id` 与 `--rollback-package-id` 必须不同**：service 层会校验，agent 在生成命令前也应主动校验。
5. **回滚前先用 `package online list` 与 `ticket get` 确认线上包现状与原发布单**：避免用过期 / 模糊匹配的 packageId 触发回滚。

### `ticket execute` 安全规则（MUST follow）

1. **online deployment 工单必须先 `--dry-run`**：执行 online 工单等同于触发线上发布，必须把请求体展示给用户。
2. **不传 `--deployment-type` 时 fail-safe 视为 HIGH**；agent 在调 `ticket execute` 之前应主动用 `ticket get` 或上下文确认目标工单是 in-house 还是 online。
3. **`ticket cancel` / `ticket retry` 是 low risk**，但仍建议先用 `ticket get --ticket-id` 确认工单状态、避免误操作。

## `ticket get --watch` — 内置终态轮询（agent 等待优先用这个）

`tiktok-gecko ticket get` 支持 `--watch` 模式：CLI 内部按固定间隔轮询 ticket 详情，直到 ticket 跑到终态（成功 / 失败 / 取消 / 回滚）或超时。Agent / 用户不需要再自己写 sleep loop。

```bash
# 默认 5s 间隔、600s 超时
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko ticket get \
  --ticket-id <ticket_id> --watch

# 自定义节奏（JSON 模式输出 NDJSON 状态变化流 + 最终 envelope）
bytedcli --json --site i18n-tt --auth-site tiktok tiktok-gecko ticket get \
  --ticket-id <ticket_id> --watch --watch-interval 10 --watch-timeout 1800
```

### Flags

| Flag | 默认值 | 校验 |
| --- | --- | --- |
| `--watch` | off | 启用后才会进入 polling；不传 `--watch` 时 `--watch-interval/--watch-timeout` 会被忽略并打印 warn |
| `--watch-interval <seconds>` | 5 | 1 ≤ value ≤ 60 整数 |
| `--watch-timeout <seconds>` | 600（10 分钟） | 5 ≤ value ≤ 3600 整数；且必须 > `--watch-interval` |

### Ticket 状态码（与后端 `ticketStatus` 完全对齐）

| Code | Name | 终态 | 说明 |
| ---: | --- | :---: | --- |
| 0 | INIT | | 初始 |
| 1 | PENDING_AUDIT | | 待审 |
| 2 | REJECT | ✓ | 失败终态：审核被拒 |
| 3 | PASS | | 审核通过但还没执行（不算成功终态） |
| 4 | PENDING_EXECUTE | | 待执行 |
| 5 | RUNNING | | 执行中 |
| 6 | FAILED | ✓ | 失败终态：执行失败 |
| 7 | CANCELING | | 取消中 |
| 8 | CANCELED | ✓ | 失败终态：已取消 |
| 9 | ROLLING_BACK | | 回滚中 |
| 10 | ROLLBACK | ✓ | 失败终态：已回滚 |
| 11 | SUCCESS | ✓ | **成功终态** |

> `regionTicketStatus`（每个 region 子工单的状态）是另一套枚举，watch 命令只看 top-level `ticketStatus`，不会混用。

### 退出码

| Exit | 触发条件 |
| ---: | --- |
| 0 | 终态 = SUCCESS(11) |
| 1 | 终态 = REJECT(2) / FAILED(6) / CANCELED(8) / ROLLBACK(10) |
| 2 | 超时未到终态 |
| 130 | SIGINT (Ctrl+C)；退出前会打印当前观测到的最后状态 |

### 输出格式

**文本模式**（默认）：每次状态变化打印一行；中间相同状态不重复打印；终态后追加 summary：

```
[2026-05-15T22:50:00.000Z] ticket <ticket_id> status=5 RUNNING (initial observation, elapsed=12ms, poll=1)
[2026-05-15T22:50:15.000Z] ticket <ticket_id> status=11 SUCCESS (transition from RUNNING, elapsed=15012ms, poll=3)
Ticket <ticket_id> finished: SUCCESS (15s, polls=3)
```

**JSON 模式**（`-j` / `--json`）：先输出每条状态变化的 NDJSON 行：

```json
{"kind":"ticket_status_change","ticket_id":"<ticket_id>","status":5,"status_name":"RUNNING","at":"2026-05-15T22:50:00.000Z","poll_count":1}
{"kind":"ticket_status_change","ticket_id":"<ticket_id>","status":11,"status_name":"SUCCESS","at":"2026-05-15T22:50:15.000Z","poll_count":3}
```

最后一行是常规的 `outputResult` envelope（`status: success | error`），`data` 字段包含：

- `action: "ticket_watch"`
- `terminal_status` (number) / `terminal_status_name` (string)
- `outcome`：`success` / `failure` / `timeout` / `aborted`
- `polls`、`elapsed_ms`
- `last_detail`：最后一次 `getTicketDetail` 的完整响应

## release / ticket 关系说明

CLI 不再单独提供 `release list / release get / release cancel`。Release 在后端本质上就是一个 release 类型的 ticket，因此：

- **取消 release 工单** → `tiktok-gecko ticket cancel --ticket-id <release_ticket_id>`
- **查询 release 工单详情** → `tiktok-gecko ticket get --ticket-id <release_ticket_id>`
- **列出 release 工单** → `tiktok-gecko ticket list --type <release_type_code>`（按 ticketType 数值过滤）
- **重试 / 执行 release 工单** → `tiktok-gecko ticket retry/execute --ticket-id <release_ticket_id>`（注意 risk gating）
- **重新提交 release** → `tiktok-gecko release create`（不要尝试用 ticket retry 来"重发"失败的 release，retry 仅在工单内重试节点逻辑）

## Agent-facing 协议

> 这一节面向 Claude Code、Cursor、其他 LLM agent。在自动化场景下严格按以下流程使用本 skill。

1. **低风险命令**（risk = low）
   - 对应：`*list / *get` 等只读命令、`release create --deployment-type in-house`、`ticket cancel`、`ticket retry`、`ticket execute --deployment-type in-house`
   - Agent 行为：可直接调用 CLI 执行，输出结果给用户。

2. **高风险命令**（risk = high）
   - 对应：`release create --deployment-type online`（或缺省 `--deployment-type`）、`package online rollback`（始终高风险）、`ticket execute --deployment-type online`（或缺省 `--deployment-type`）
   - Agent 行为：
     1. **MUST 先用 `--dry-run` 调一次**，从输出里拿到完整的 request body 与 risk 等级。
     2. **把 dry-run preview 完整展示给用户**（包括 URL、headers、body、影响范围）。
     3. **等用户在对话里明确同意**（"go" / "确认" / "yes" 等）。
     4. **agent 把同一条命令去掉 `--dry-run`、加上 `--yes` 重新执行**，并把响应交回用户。
   - **不要在用户没明确同意时自动加 `--yes`**；不要把高风险命令藏在脚本/批处理里悄悄跑。

3. **如何判断目标是 online 还是 in-house**
   - `tiktok-gecko deployment get --deployment-id <id>` 的 `Type` 字段、或 `ticket get --ticket-id <id>` 详情里的 `deploymentType`：`1 = online`、`2 = in-house`。
   - 把判断结果作为 `--deployment-type` 参数显式传入；不要省略它。

4. **等待工单跑完**
   - 触发 `release create` / `package online rollback` / `ticket execute|retry|cancel` 之后想等结果时，**MUST** 用 `tiktok-gecko ticket get --ticket-id <id> --watch`，**不要自己写 sleep loop**。
   - 退出码已经按"成功 0 / 失败 1 / 超时 2 / 中断 130"约定好，shell / agent / CI 都能直接消费。
   - 在 `--json` 模式下读 NDJSON 状态变化行可以做实时反馈，最后一行 envelope 给最终判定。

## 常用操作指南

1. **先拿列表再查详情**：先用 `list` 命令确认资源 ID，再用 `get` 命令拉详细信息，避免手填错误 ID。
   - `channel get --channel-id` 需要传 **channel meta id**（例如 `channel list` 返回里的 `metaIdList`），不是 deployment 下的 channel region id。
2. **先按条件缩小范围**：`channel list` 可用 `--region` / `--name`；`ticket list` 可用 `--creator` / `--reviewer` / `--status` / `--type`。
   - 查询某个 channel 的资源包时，优先使用 `channel package list`（底层接口为 `channel/package-meta/list`）。
   - 查询某个 channel 的线上包（已下发到 CDN 的包）时使用 `package online list`。
3. **排查部署关联关系**：先 `deployment get` 看部署基本信息，再用 `deployment channel list` 看挂载 Channel。
4. **结构化输出给自动化流程**：在全局参数添加 `--json`，例如 `bytedcli --json --site i18n-tt tiktok-gecko app list`。

## Notes

- `tiktok-gecko` 当前覆盖只读查询 + 写操作（release create / package online rollback / ticket cancel|retry|execute）。其他写操作（资源 CRUD、approval 审批等）尚未实现。
- `tiktok-gecko` 支持 `--site i18n-tt`（TikTok ROW prod，TikTok SSO 默认）与 `--site boe`（BOE i18n 分区，bytedance SSO 默认）。也可通过 `BYTEDCLI_CLOUD_SITE` 环境变量设置。两站点的 base URL、JWT 颁发 host 与 permission apply URL 都按 site 自动切换；显式传入与该 site 不匹配的 `--auth-site`（例如 `--site i18n-tt --auth-site bytedance`）会被入口校验直接拒绝。
- BOE 不需要手动传 `--vregion`：`--site boe` 时 CLI 内部会按隐式 `boei18n` 分区计算 SSO env，并把 JWT 取自 `cloud.bytedance.net`。
- `tiktok-gecko ticket list` 的时间筛选参数使用 epoch 毫秒：`--create-start-time` / `--create-end-time`。
- `deployment channel list` 默认 `--type all`，与控制台部署详情页默认筛选一致。
- 资源包环境可通过 `deploymentName` 快速判断：`online_deployment` 通常为线上包，`in_house_deployment` 通常为测试包。
- `package online list` 至少需要 `--channel-id` 或 `--channel-region-id` 之一（推荐 `--channel-region-id`）。
- 写操作的 `--deployment-type` 参数 **仅用于 CLI 端 risk gating**，不会转发到后端；后端会从 target 里自行推导。
- 写操作的 `--x-target-regions` 转发为 `x-target-regions` 请求头（与控制台调试一致）。
- 高风险命令在非 TTY 环境下若没有 `--yes`，CLI 会以结构化错误码 `TIKTOK_GECKO_HIGH_RISK_NEED_YES` 拒绝执行；TTY 下会弹 `Proceed with HIGH RISK ... [y/N]` 交互 prompt。
