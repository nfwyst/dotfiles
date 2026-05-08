# IDL

Gateway 从 Codebase 拉取 IDL（Thrift / HTTP JSON / YAML），解析后在 lgw-console 侧维护 method 列表。每次 import 会生成一个新版本。

所有命令接受 `--gateway-env <env>`（默认 `boe-cn`）。

## `idl versions`

List IDL versions registered for a service (read-only).

```bash
bytedcli lark-devops gateway idl versions \
  --project-id <id> --psm <psm> [--gateway-env <env>]
```

JSON:

```json
{
  "status": "success",
  "data": {
    "items": [
      { "version": "1.0.2", "field_info": { "id": 42, "commit_id": "abc123", ... } }
    ]
  }
}
```

## `idl methods`

List methods under the latest IDL version for a service.

```bash
bytedcli lark-devops gateway idl methods \
  --project-id <id> --psm <psm> [--gateway-env <env>]
```

JSON: `{ items: [{ method, path, ... }] }`

## `idl import` (重写 / dry-run gated)

Import IDL from Codebase. The CLI performs the full Python flow internally:

1. GET Codebase param (resolves `repo_name` + default `revision` + `main_file_path`)
2. GET service `import/param` → `idl_parser_extra` base config
3. GET `diffs/config` → merge online-deployed display-name keys into internal-name keys (e.g. `for_apaas` → `idl_for_apaas`; `parse_mod` `Default/GoTag/GoTagAndIDL` → `0/1/2`)
4. GET `/lgw-console/idl/files/contents` → fetch IDL files for the target revision
5. POST `import/<strategy>/preview` → preview body
6. On live: POST `import/<strategy>/confirm` → actually create the new version

```bash
bytedcli lark-devops gateway idl import \
  --project-id <id> --psm <psm> \
  [--strategy overwrite|increase] \
  [--revision <branch-or-ref>] \
  [--gateway-env <env>] \
  [--execute --yes-i-know-this-is-live]
```

| Option | Required | Default | Description |
|---|---|---|---|
| `--strategy <mode>` | — | `overwrite` | Import strategy: `overwrite` or `increase` |
| `--revision <ref>` | — | service's configured default branch | Codebase branch / ref / tag |
| `--execute` | — | — | Actually call the confirm endpoint |
| `--yes-i-know-this-is-live` | with `--execute` | — | Live confirmation |

### Strategy semantics

- **`overwrite`** — 覆盖导入。新版本替换全部 methods，未在新 IDL 中出现的旧 method 会从 gateway 上下线
- **`increase`** — 增量导入。只做 adds + updates；preview 返回 `{news, updates, non_updates}` 三个 bucket，live 时合并到已有版本

> ⚠️ `--strategy` 有效值是 `overwrite | increase`，**不是** `incremental`（与 Python 源保真）。

### Dry-run vs live

- **Dry-run**（默认）：执行到 step 5 (preview)，打印 preview payload + counts，**不写** confirm endpoint。Agent 此时人工确认覆盖量 / 增量数量 / method diff 合理。
- **Live**（`--execute --yes-i-know-this-is-live`）：在 preview 成功后自动继续调 confirm endpoint，输出 `{mode:"live", confirm_data}`。

Preview JSON output shapes:

```json
// overwrite
{ "mode": "dry-run", "strategy": "overwrite", "preview": { "methods": [ ... ] }, "method_count": 42 }

// increase
{ "mode": "dry-run", "strategy": "increase", "preview": { "news": [ ... ], "updates": [ ... ], "non_updates": [ ... ] }, "news_count": 5, "updates_count": 12, "non_updates_count": 25 }
```

### IDL type auto-detect

CLI 根据 `main_file_path` 后缀自动判定 `idl_type`：

- `.thrift` → `idl_type=1` (Thrift)
- `.json` / `.yaml` / `.yml` → `idl_type=0` (HTTP)

## Typical workflow

```bash
# 1. Inspect current state
bytedcli --json lark-devops gateway idl versions \
  --project-id 123 --psm example.service.api --gateway-env boe-cn

bytedcli --json lark-devops gateway idl methods \
  --project-id 123 --psm example.service.api --gateway-env boe-cn

# 2. Preview import from a feature branch
bytedcli --json lark-devops gateway idl import \
  --project-id 123 --psm example.service.api \
  --strategy increase \
  --revision feat/new-endpoint \
  --gateway-env boe-cn

# 3. Review preview.news / preview.updates counts; if OK, live:
bytedcli --json lark-devops gateway idl import \
  --project-id 123 --psm example.service.api \
  --strategy increase \
  --revision feat/new-endpoint \
  --gateway-env boe-cn \
  --execute --yes-i-know-this-is-live

# 4. Verify new version
bytedcli --json lark-devops gateway idl versions \
  --project-id 123 --psm example.service.api --gateway-env boe-cn
```

## Notes

- `--revision` 不传时用 service 在 lgw-console 上配置的默认 branch（通常是 `master` / `main`）
- `idl_parser_extra` 字段（`idl_for_apaas / idl_optional_for_default / idl_for_old_ccm / idl_for_lobster / idl_for_itoa_when_too_big / idl_for_ee_gateway / idl_not_omit_empty_for_optional_field / parse_mod`）由 CLI 自动从服务线上 config 读取并合并，用户无需手动传
- `overwrite` 会物理下线 method，影响 bind 到这些 method 的 plugin / IDL 路由，务必 dry-run 核对 `method_count`
- 导入后若要真正对外生效，还需后续 `deploy create`（IDL 只改了 gateway 的 config，未 deploy 仍走老 IDL）
