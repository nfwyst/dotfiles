# Project

Gateway projects are the top-level container on lgw-console. Each project pins one or more PSMs (services) and gets its own plugin / IDL / deploy surface.

All commands below accept `--gateway-env <env>` (default `boe-cn`). Valid envs: `boe-cn`, `boe-i18n`, `pre-cn`, `pre-i18n`, `prod-cn`, `prod-i18n`.

## Commands

### `project list`

List gateway projects in the target env. Supports keyword search + pagination.

```bash
bytedcli lark-devops gateway project list [options]
```

| Option | Required | Default | Description |
|---|---|---|---|
| `--keyword <kw>` | — | — | Filter by keyword (server-side match on project name/description) |
| `--page <n>` | — | `1` | Page number (1-based) |
| `--limit <n>` | — | `20` | Page size (wire name: `size`) |
| `--gateway-env <env>` | — | `boe-cn` | Target gateway env |

JSON output shape:

```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": 123,
        "name": "demo-project",
        "description": "...",
        "is_fav": true
      }
    ],
    "total": 42,
    "page": 1,
    "size": 20
  }
}
```

### `project get`

Fetch a single project's detail (includes registered services, plugin package counts, deployment pointer).

```bash
bytedcli lark-devops gateway project get --project-id <id> [--gateway-env <env>]
```

| Option | Required | Description |
|---|---|---|
| `--project-id <id>` | ✅ | Gateway project id |

JSON output shape:

```json
{
  "status": "success",
  "data": {
    "id": 123,
    "name": "demo-project",
    "description": "...",
    "services": [ { "psm": "example.service.api", ... } ],
    "is_fav": true
  }
}
```

### `project star`

Star (favorite) a project.

```bash
bytedcli lark-devops gateway project star --project-id 123 --gateway-env boe-cn
```

Light-write, **not dry-run gated** per spec §3.1 (same for `unstar`). Returns:

```json
{ "status": "success", "data": { "ok": true } }
```

### `project unstar`

Unstar a project.

```bash
bytedcli lark-devops gateway project unstar --project-id 123 --gateway-env boe-cn
```

## Typical Agent workflow

**User says "帮我把 boe-cn 上叫 demo 的项目收藏":**

```bash
# Step 1: find project id
bytedcli --json lark-devops gateway project list --keyword demo --gateway-env boe-cn
# → items[0].id

# Step 2: star it
bytedcli --json lark-devops gateway project star --project-id 123 --gateway-env boe-cn
```

**User says "看我收藏的项目列表":**

Call `project list` repeatedly with `--page` until `items[*].is_fav === true` filtering client-side returns everything. `is_fav` is the field to key on.

## Notes

- `list` / `get` 完全只读。`star` / `unstar` 是轻写，无 dry-run 守门，失败即报 `LARK_DEVOPS_GATEWAY_API_ERROR`。
- Project 的 id 是 **integer**（不是 PSM 字符串）。用户给 PSM 时先用 `project list --keyword` 解析。
- 同一个 PSM 可以注册到多个 project（不同 env 或不同业务线隔离）；id 是 env 内全局唯一。
