# Plugin

Plugin management splits into two subgroups:

- **`plugin method`** — attach/detach a plugin to/from a single method (fine-grained, per-endpoint config)
- **`plugin package`** — bind/unbind a reusable plugin package to a batch of methods (or globally to all methods)

Plugins typically handle cross-cutting concerns: rate-limit, auth, CSRF, access log, etc. Each plugin has a **plugin_id** (numeric, catalog-wide) and a per-method **config** blob.

All commands accept `--gateway-env <env>` (default `boe-cn`).

## `plugin method`

### `plugin method list`

List plugins attached to methods in a project.

```bash
bytedcli lark-devops gateway plugin method list \
  --project-id <id> \
  [--method-id <id>] [--psm <psm>] [--name <name>] \
  [--page 1] [--size 20] [--gateway-env <env>]
```

| Option | Description |
|---|---|
| `--method-id <id>` | Filter by method id |
| `--psm <psm>` | Filter by service PSM (wire: `service_psm`) |
| `--name <name>` | Filter by method display name |

JSON: `{ items: [{ method_id, plugin_id, plugin_name, config_fields: [...] }], total }`

### `plugin method add` (dry-run gated)

Attach a plugin to a single method.

```bash
bytedcli lark-devops gateway plugin method add \
  --project-id <id> --method-id <id> --plugin-id <id> \
  [--plugin-name <name>] \
  [--config '[{"name":"qps","value":100}]'] \
  [--gateway-env <env>] \
  [--execute --yes-i-know-this-is-live]
```

| Option | Required | Description |
|---|---|---|
| `--method-id <id>` | ✅ | Target method id |
| `--plugin-id <id>` | ✅ | Plugin definition id from catalog |
| `--plugin-name <name>` | — | Display label (optional) |
| `--config <json>` | — (default `[]`) | JSON array of `{name, value}` field entries; `JSON.parse` failure → exit 2 |

### `plugin method delete` (dry-run gated)

Detach a plugin from a method.

```bash
bytedcli lark-devops gateway plugin method delete \
  --project-id <id> --method-id <id> --plugin-id <id> \
  [--gateway-env <env>] [--execute --yes-i-know-this-is-live]
```

## `plugin package`

### `plugin package list`

List packages available under a project.

```bash
bytedcli lark-devops gateway plugin package list \
  --project-id <id> [--package-id <id>] [--name <name>] \
  [--page 1] [--size 20] [--gateway-env <env>]
```

### `plugin package get` (alias `detail`)

Show a single package with bundled templates.

```bash
bytedcli lark-devops gateway plugin package get --project-id <id> --package-id <id>
# or using alias:
bytedcli lark-devops gateway plugin package detail --project-id <id> --package-id <id>
```

> Main command name is `get` (bytedcli convention); `detail` kept as alias for Python-source parity.

### `plugin package impact`

List interfaces (methods) impacted by a package.

```bash
bytedcli lark-devops gateway plugin package impact \
  --project-id <id> --package-id <id> [--page 1] [--size 20]
```

JSON: `{ items: [{ method_id, psm, method_name, ... }], total }`

### `plugin package bind` (dry-run gated)

Bind a package to specific methods or globally.

```bash
bytedcli lark-devops gateway plugin package bind \
  --project-id <id> --package-id <id> \
  [--method-ids 7,8,9] [--global] \
  [--gateway-env <env>] [--execute --yes-i-know-this-is-live]
```

| Option | Notes |
|---|---|
| `--method-ids <csv>` | CSV of method ids |
| `--global` | Install to every method in the project |

Either `--method-ids` or `--global` (or both) MUST be provided, otherwise `failArgs` (exit 2).

### `plugin package unbind` (dry-run gated)

Unbind a package from methods; omit `--method-ids` to unbind from every method.

```bash
bytedcli lark-devops gateway plugin package unbind \
  --project-id <id> --package-id <id> \
  [--method-ids 7,8] \
  [--gateway-env <env>] [--execute --yes-i-know-this-is-live]
```

## AI Agent workflow: copy plugin config from one method to another

常见需求：把 method A 上的所有 plugin（及 config）完整复制到 method B。

```bash
# Step 1: list plugins on source method A
bytedcli --json lark-devops gateway plugin method list \
  --project-id 123 --method-id 7 --gateway-env boe-cn
# → items[]: [{ plugin_id, plugin_name, config_fields: [...] }, ...]

# Step 2: for each item, call plugin method add on target method B (dry-run first)
for each item in items:
  bytedcli --json lark-devops gateway plugin method add \
    --project-id 123 --method-id 42 \
    --plugin-id <item.plugin_id> \
    --plugin-name <item.plugin_name> \
    --config '<JSON.stringify(item.config_fields)>' \
    --gateway-env boe-cn

# Step 3: review each dry-run envelope body, then add --execute --yes-i-know-this-is-live
```

Tips:
- Always dry-run first to preview `body`. If any `plugin_id` is invalid on the target (e.g. the catalog differs across projects), the dry-run will still succeed — you only see the API error on live execute.
- If source and target are in different gateway envs, call the list in source env and add in target env.

## AI Agent workflow: bulk-bind a package to a list of methods

```bash
# Step 1: resolve method ids by PSM
bytedcli --json lark-devops gateway plugin method list \
  --project-id 123 --psm example.service.api --gateway-env boe-cn

# Step 2: collect method_ids -> CSV "7,8,9,10"

# Step 3: dry-run bind
bytedcli --json lark-devops gateway plugin package bind \
  --project-id 123 --package-id 99 --method-ids 7,8,9,10 --gateway-env boe-cn

# Step 4: review body.method_ids, then live
bytedcli --json lark-devops gateway plugin package bind \
  --project-id 123 --package-id 99 --method-ids 7,8,9,10 --gateway-env boe-cn \
  --execute --yes-i-know-this-is-live
```

## Notes

- `--config` 对 `plugin method add` 是 JSON array 字符串（字段列表）；shell 里要用单引号包 JSON，例如 `--config '[{"name":"qps","value":100}]'`
- `plugin package get`（主名）与 `plugin package detail`（alias）等价；新脚本统一用 `get`
- `plugin package bind` / `unbind` 的 `--method-ids` CSV 空格/空项容忍（自动 trim + filter）；全空则 `bind` 要求至少给 `--global`，`unbind` 空 = 全部 unbind
- 插件 catalog（`plugin_id`）跨 project 未必一致，复制前最好在 target project 先 `plugin method list` 确认
