# Deploy + Rollback

Deploy 是 gateway 的完整发布生命周期，共 12 条命令：6 条只读 + 6 条写（全部 dry-run gated）。Rollback 目前只有 `create` 一条写命令。

所有命令接受 `--gateway-env <env>`（默认 `boe-cn`，有效值 `boe-cn | boe-i18n | pre-cn | pre-i18n | prod-cn | prod-i18n`）。

## Dry-run / live-write 契约（critical）

对所有 write 命令（`deploy create/approve/confirm/skip/cancel/csrf-escape`、`rollback create`、`service add`、`plugin * add|delete|bind|unbind`、`idl import`）：

| Flags | 行为 |
|---|---|
| 都不给（默认） | **Dry-run**：输出 `{mode:"dry-run", method, url, body}`，不发请求 |
| `--execute` only | **拒绝**：exit 2，错误码 `LARK_DEVOPS_GATEWAY_LIVE_WRITE_REFUSED` |
| `--execute --yes-i-know-this-is-live` | **Live**：真发请求，输出 `{mode:"live", ...}` |

每次真发前先 dry-run 预览 payload，确认无误再加两个 flag。

## Read commands

### `deploy list`

Paginated deployment history.

```bash
bytedcli lark-devops gateway deploy list --project-id <id> [--page <n>] [--limit <n>] [--gateway-env <env>]
```

JSON: `{ items: [{ id, status, mode, remark, creator, create_time, ... }], total, page, size }`

### `deploy checklist`

View project-level check policy (which checks are enabled).

```bash
bytedcli lark-devops gateway deploy checklist --project-id <id> [--gateway-env <env>]
```

### `deploy check`

Run pre-deploy checks. Read-semantic POST — validates config, returns pass/fail, no state change.

```bash
bytedcli lark-devops gateway deploy check \
  --project-id <id> \
  --checks config,csrf,acl,feature-tree \
  --mode current|snapshot \
  [--snapshot-version <n>] \
  [--gateway-env <env>]
```

| Option | Required | Notes |
|---|---|---|
| `--checks <csv>` | ✅ | Subset of: `config, csrf, acl, feature-tree` |
| `--mode <mode>` | ✅ | `current` or `snapshot` |
| `--snapshot-version <n>` | when `--mode=snapshot` | Snapshot version integer |

JSON: `{ data: { results: [{ check_type, status, detail }] } }`

### `deploy status`

One-shot status; `--watch` polls until terminal state or timeout.

```bash
bytedcli lark-devops gateway deploy status --project-id <id> --deploy-id <id> [--gateway-env <env>]
bytedcli lark-devops gateway deploy status --project-id <id> --deploy-id <id> --watch \
  [--interval-ms 3000] [--timeout-ms 600000]
```

JSON (terminal states):

```json
{ "status": "success", "data": { ... } }
{ "status": "failed", "reason": "..." }
{ "status": "pending", "job_id": 7, "progress": {...}, "retry_hint": "bytedcli --json lark-devops gateway deploy status --project-id 123 --deploy-id 7 --gateway-env boe-cn --watch" }
```

**Watch contract:**

- Default `--interval-ms 3000`, `--timeout-ms 600000` (10min)
- Text mode: in-place progress updates via `\r`
- JSON mode: emits only terminal envelope
- **Timeout is not an error**: exit 0 with `{status:"pending", retry_hint}`
- `success` → exit 0; `failed` / `cancelled` → exit 1

### `deploy process`

Advance a deployment to its next stage (auto-resolves `stage_id` when omitted).

```bash
bytedcli lark-devops gateway deploy process --project-id <id> --deploy-id <id> [--stage-id <id>]
```

When `--stage-id` is omitted, service layer calls `_resolve_stage_id()` — fetches deployment status and uses `current_stage_id` (matches Python behavior).

### `deploy csrf-reasons`

Enum lookup: available CSRF exemption reasons (global, no project-id).

```bash
bytedcli lark-devops gateway deploy csrf-reasons [--gateway-env <env>]
```

JSON: `{ items: [{ type: 1, name: "legacy_api", ... }] }`

## Write commands (all dry-run gated)

### `deploy create`

Create a new deployment.

```bash
bytedcli lark-devops gateway deploy create \
  --project-id <id> \
  --mode current|snapshot \
  [--snapshot-version <n>] \
  [--remark "<text>"] \
  [--acl-skipped] [--csrf-skipped] [--feature-tree-skipped] \
  [--gateway-env <env>] \
  [--execute --yes-i-know-this-is-live]
```

Body (live): `{ deploy_mode, snapshot_version?, remark?, acl_skipped, csrf_skipped, feature_tree_skipped }`.

### `deploy approve`

Approve or reject a stage.

```bash
bytedcli lark-devops gateway deploy approve \
  --project-id <id> --deploy-id <id> [--stage-id <id>] \
  --action approve|reject \
  [--gateway-env <env>] [--execute --yes-i-know-this-is-live]
```

### `deploy confirm`

Confirm or unconfirm a stage.

```bash
bytedcli lark-devops gateway deploy confirm \
  --project-id <id> --deploy-id <id> [--stage-id <id>] \
  --action confirm|unconfirm \
  [--gateway-env <env>] [--execute --yes-i-know-this-is-live]
```

### `deploy skip`

Skip a stage with a reason.

```bash
bytedcli lark-devops gateway deploy skip \
  --project-id <id> --deploy-id <id> [--stage-id <id>] \
  --reason "<text>" \
  [--gateway-env <env>] [--execute --yes-i-know-this-is-live]
```

### `deploy cancel`

Cancel an in-flight deployment.

```bash
bytedcli lark-devops gateway deploy cancel \
  --project-id <id> --deploy-id <id> \
  [--gateway-env <env>] [--execute --yes-i-know-this-is-live]
```

### `deploy csrf-escape`

Register CSRF escape entries for a project.

```bash
bytedcli lark-devops gateway deploy csrf-escape \
  --project-id <id> \
  --escapes '[{"method_id":7,"csrf_escape_type":1}]' \
  [--gateway-env <env>] [--execute --yes-i-know-this-is-live]
```

`--escapes` is a JSON-array string; invalid JSON aborts with exit 2.

## Rollback

### `rollback create`

Create a rollback for a historical deployment.

```bash
bytedcli lark-devops gateway rollback create \
  --project-id <id> \
  --deployment-id <id> \
  --type runtime|full \
  [--rollback-units BOE,CN,VA,...] \
  [--remark "<text>"] \
  [--gateway-env <env>] [--execute --yes-i-know-this-is-live]
```

| Option | Values |
|---|---|
| `--type` | `runtime` (hot switch only) or `full` (full rollback) |
| `--rollback-units` | CSV from: `BOE, BOEI18N, CN, VA, SG, JP, MY, USTTP, EUTTP, USTTP3` |

## Typical workflow

```bash
# 1. Check baseline
bytedcli --json lark-devops gateway deploy checklist --project-id 123 --gateway-env prod-cn

# 2. Run pre-checks
bytedcli --json lark-devops gateway deploy check \
  --project-id 123 --checks config,csrf,acl --mode current --gateway-env prod-cn

# 3. Dry-run create (preview payload)
bytedcli --json lark-devops gateway deploy create \
  --project-id 123 --mode current --remark "release v1.2" --gateway-env prod-cn

# 4. Live create
bytedcli --json lark-devops gateway deploy create \
  --project-id 123 --mode current --remark "release v1.2" --gateway-env prod-cn \
  --execute --yes-i-know-this-is-live

# 5. Poll until terminal
bytedcli --json lark-devops gateway deploy status \
  --project-id 123 --deploy-id 7 --gateway-env prod-cn --watch
```

## Notes

- Wire-level enum values (service layer translates CLI strings → ints):
  - `--mode`: `current=1`, `snapshot=2`
  - `--checks`: `config=1, csrf=2, acl=3, feature-tree=4`
  - `--action` (approve): `approve=1 (pass)`, `reject=2 (refuse)`
  - `--action` (confirm): `confirm=1`, `unconfirm=2`
  - `--type` (rollback): `runtime=1`, `full=2`
  - `--rollback-units`: `BOE=0, BOEI18N=1, CN=2, VA=3, SG=4, JP=5, MY=6, USTTP=7, EUTTP=8, USTTP3=9`
- `_resolve_stage_id` auto-resolve applies to `deploy process / approve / confirm / skip` when `--stage-id` is omitted.
- Deployment status values reverse-map: `0 Undefined / 1 Publishing / 2 Canceled / 3 Succeeded / 4 Failed`.
- Stage status values: `0 Undefined / 1 NotStarted / 2 Processing / 3 Succeeded / 4 Failed / 5 Canceled / 6 Skipped / 7 Refused`.
