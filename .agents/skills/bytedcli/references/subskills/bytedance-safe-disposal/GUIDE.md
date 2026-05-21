---
name: bytedance-safe-disposal
description: Safe disposal center operations via bytedcli safe domain. Use this when the user wants to list disposal center platform types or scenes, list features or abilities, query disposal feature/action metadata, copy a disposal feature or action reference, create request-backed or puzzle-backed disposal feature approval tickets, or filter by PlatformTypeEnum, SceneIdEnum, FeatureKey, ActionRegisterKey, or SearchKey.
---

# Safe Disposal — Platforms, Scenes, Features, And Abilities

Query platform type, scene, feature, and action-reference metadata from the Safe disposal center, copy an existing feature or action reference into a publish ticket, and create request-backed or puzzle-backed feature publish tickets.

## Commands

```bash
bytedcli safe disposal platform list [--tenant <tenant>]
bytedcli safe disposal scene list --platform-type <n> [--tenant <tenant>]
bytedcli safe disposal feature list --platform-type <n> --scene-id <n> [--keyword <text>] [--tenant <tenant>]
bytedcli safe disposal ability list --platform-type <n> --scene-id <n> [--keyword <text>] [--tenant <tenant>]
bytedcli safe disposal feature create-request --feature-key <key> --feature-name <name> --feature-desc <text> --value-type <type> --platform-type <n> --scene-id <n> --req-path <path> [--reason <text>] [--dry-run] [--yes] [--tenant <tenant>]
bytedcli safe disposal feature create-puzzle --feature-key <key> --feature-name <name> --feature-desc <text> --value-type <type> --platform-type <n> --scene-id <n> --tenant <tenant> --pkg-code <code> --puzzle-feature-key <key> --item-code <code> --pkg-param <key=value> [--pkg-param <key=value> ...] [--reason <text>] [--dry-run] [--yes]
bytedcli safe disposal feature copy --from-platform-type <n> --from-scene-id <n> --to-platform-type <n> --to-scene-id <n> --feature-key <key> [--tenant <tenant>]
bytedcli safe disposal ability copy --from-platform-type <n> --from-scene-id <n> --to-platform-type <n> --to-scene-id <n> --action-register-key <key> [--tenant <tenant>]
```

## Examples

```bash
bytedcli safe disposal platform list

bytedcli --json safe disposal platform list

bytedcli safe disposal scene list --platform-type 1

bytedcli --json safe disposal scene list --platform-type 1

bytedcli safe disposal feature list --platform-type 1 --scene-id 2

bytedcli safe disposal feature list \
  --platform-type 1 \
  --scene-id 2 \
  --keyword target_id

bytedcli --json safe disposal feature list \
  --platform-type 1 \
  --scene-id 2 \
  --keyword target_id

bytedcli safe disposal ability list \
  --platform-type 1 \
  --scene-id 2 \
  --keyword demo_action

bytedcli --json safe disposal ability list \
  --platform-type 1 \
  --scene-id 2 \
  --keyword demo_action

bytedcli safe disposal feature create-request \
  --feature-key sample_request_feature \
  --feature-name "Sample Request Feature" \
  --feature-desc "Sample request feature description" \
  --value-type int \
  --platform-type 1 \
  --scene-id 2 \
  --req-path '["Extra","sample_request_feature"]' \
  --dry-run

bytedcli --json safe disposal feature create-request \
  --feature-key sample_request_feature \
  --feature-name "Sample Request Feature" \
  --feature-desc "Sample request feature description" \
  --value-type int \
  --platform-type 1 \
  --scene-id 2 \
  --req-path Extra.sample_request_feature \
  --reason "Create sample request feature" \
  --yes

bytedcli safe disposal feature create-puzzle \
  --feature-key sample_puzzle_feature \
  --feature-name "Sample Puzzle Feature" \
  --feature-desc "Sample puzzle feature description" \
  --value-type bool \
  --platform-type 1 \
  --scene-id 2 \
  --tenant sample-tenant \
  --pkg-code sample-package \
  --puzzle-feature-key sample_puzzle_key \
  --item-code sample_item \
  --pkg-param sample_input=sample_feature \
  --dry-run

bytedcli --json safe disposal feature create-puzzle \
  --feature-key sample_puzzle_feature \
  --feature-name "Sample Puzzle Feature" \
  --feature-desc "Sample puzzle feature description" \
  --value-type bool \
  --platform-type 1 \
  --scene-id 2 \
  --tenant sample-tenant \
  --pkg-code sample-package \
  --puzzle-feature-key sample_puzzle_key \
  --item-code sample_item \
  --pkg-param sample_input=sample_feature \
  --reason "Create sample puzzle feature" \
  --yes

bytedcli safe disposal feature copy \
  --from-platform-type 1 \
  --from-scene-id 2 \
  --to-platform-type 1 \
  --to-scene-id 13 \
  --feature-key demo_feature

bytedcli --json safe disposal feature copy \
  --from-platform-type 1 \
  --from-scene-id 2 \
  --to-platform-type 1 \
  --to-scene-id 13 \
  --feature-key demo_feature

bytedcli safe disposal ability copy \
  --from-platform-type 1 \
  --from-scene-id 2 \
  --to-platform-type 1 \
  --to-scene-id 13 \
  --action-register-key demo_action-1-2-3

bytedcli --json safe disposal ability copy \
  --from-platform-type 1 \
  --from-scene-id 2 \
  --to-platform-type 1 \
  --to-scene-id 13 \
  --action-register-key demo_action-1-2-3
```

## Options

- `--platform-type <n>` — `PlatformTypeEnum`, the industry or content-type enum for scene, feature, and ability list queries.
- `--scene-id <n>` — `SceneIdEnum`, the scene or business-category enum for feature and ability list queries.
- `--keyword <text>` — Optional fuzzy search keyword. Feature list maps this to `SearchKey`; ability list maps this to `search_key`.
- `--feature-key <key>` / `--feature-name <name>` / `--feature-desc <text>` — New feature metadata for create commands. `--feature-desc` is required for feature creation and should describe the business meaning of the feature. The upstream API does not strictly reject an empty description, but the CLI/Agent must still require it because publish tickets and feature lists are read by humans; an empty description makes the feature confusing to review and maintain.
- `--value-type <type>` — Feature value type enum for create commands. For `feature create-puzzle`, the Agent should derive this from the selected Puzzle feature option when possible, then pass the final value to the CLI.
- `--req-path <path>` — Required for `feature create-request`. This becomes `access_param.from_req_param`; pass a JSON array such as `["Extra","sample_request_feature"]` or a dot path such as `Extra.sample_request_feature`.
- `--pkg-code <code>` / `--puzzle-feature-key <key>` / `--item-code <code>` — Required for `feature create-puzzle`; these should be selected by the Agent after querying Puzzle package and feature candidates.
- `--pkg-param <key=value>` — Repeatable binding for `feature create-puzzle`. Left side is the Puzzle input param key; right side is the disposal feature key to bind.
- `--reason <text>` — Optional approval reason for create commands.
- `--dry-run` — Print the final feature payload without creating an approval ticket.
- `--yes` — Required for create commands when actually creating an approval ticket.
- `--from-platform-type <n>` / `--from-scene-id <n>` — Source scope for `feature copy` and `ability copy`.
- `--to-platform-type <n>` / `--to-scene-id <n>` — Target scope for `feature copy` and `ability copy`.
- `--action-register-key <key>` — Exact source action reference key for `ability copy`. Action register keys are globally unique, and `ability copy` requires this key instead of `action_key`.
- `--tenant <tenant>` — Tenant for Safe API requests. For `feature create-puzzle`, this option is required because Puzzle feature creation requires a tenant value; it authenticates the Safe request tenant and is also written to `access_param.puzzle_param.tenant` as the Puzzle tenant code.

## Output

- `platform list` text mode renders platform type, name, raw value, and extra metadata.
- `scene list` text mode renders platform type, scene ID, name, raw value, and extra metadata.
- Text mode renders a table with feature ID, key, name, value type, status, usage type, access type, version, and operator.
- `ability list` text mode renders a table with action reference ID, action key, alias, scope, target type, status, and operator.
- JSON mode returns `{ "total": number, "list": [...] }`. Platform and scene list items include normalized IDs plus upstream raw enum metadata; feature and ability list items preserve upstream fields.
- Use `ability list --json` when action-reference copy or inspection workflows need full param/object source details.
- `feature copy` text mode renders the publish ticket ID and URL.
- `feature copy` JSON mode returns `{ "id": string, "url": string, "feature": {...} }`.
- `feature create-request` text mode renders the approval ticket ID and URL, or a dry-run payload summary.
- `feature create-request` JSON mode returns `{ "id": string | null, "url": string | null, "dryRun": boolean, "feature": {...} }`.
- `feature create-puzzle` text mode renders the approval ticket ID and URL, or a dry-run payload summary.
- `feature create-puzzle` JSON mode returns `{ "id": string | null, "url": string | null, "dryRun": boolean, "feature": {...} }`.
- `ability copy` text mode renders the publish ticket ID and URL.
- `ability copy` JSON mode returns `{ "id": string, "url": string, "ability": {...} }`.
- After `feature copy`, `feature create-request`, `feature create-puzzle`, or `ability copy`, always tell the user the publish ticket approval URL and ask them to open it for approval. If the command returns only `id`, build the URL as `https://safe.bytedance.net/dev_portal/live/punish-dev-admin/publish-process/detail?id=<id>`.

## Agent Guidance

- `platform-type`, `scene-id`, and Puzzle `tenant` are user decision fields. Never infer them from natural-language words such as "live", "直播", "account", or "账号". If the user did not provide an exact enum/code, ask them to choose or confirm the final value.
- Before using `platform-type`, run `platform list`, present the available platforms, and ask the user to select one. Do not auto-select a platform from a label match.
- After the user selects a platform, run `scene list --platform-type <n>`, present the available scenes, and ask the user to select one. Do not auto-select a scene from a label match.
- Use `feature list --json` when you need to inspect the full source feature payload before copying.
- Use `ability list --json` when you need detailed action-reference metadata, including `param_source` and `object_source`.
- For `feature create-request`, confirm `feature-key`, `feature-name`, `feature-desc`, `value-type`, `platform-type`, `scene-id`, and `req-path` with the user before creating. `feature-desc` and `req-path` are business-critical; do not invent them. `feature-desc` is enforced by the CLI for human readability even though the API currently does not validate it. Use `--dry-run --json` first when the user wants to review the payload.
- `feature create-request` creates `access_type=from_req`, defaults usage type to both `quantify` and `qualitative`, selects all optional-operator nodes, and fills each node with the frontend default operators for the selected `value-type`.
- Before starting `feature create-puzzle`, ask whether the requester is an engineering user or an operations user. Use this role only to decide the confirmation style; it does not change the final Safe payload shape.
- For `feature create-puzzle`, split the workflow into discovery and creation. First collect only the requester role and new disposal feature metadata (`feature-key`, `feature-name`, required `feature-desc`). Then resolve user decision fields in order: ask for or confirm the exact Puzzle tenant code, ask the user to choose `platform-type` from `platform list`, then ask the user to choose `scene-id` from `scene list`. Do not ask for `--pkg-code`, `--puzzle-feature-key`, `--item-code`, `--value-type`, `--pkg-param`, or a generic "search keyword" in the first question.
- For `feature create-puzzle`, discover dropdown candidates through bytedcli commands that reuse the regular Safe login state:
  - Tenant candidates, when the user gave a tenant label instead of an exact code: `bytedcli --json safe puzzle tenant list`
  - Package candidates: `bytedcli --json safe puzzle pkg list --tenant <tenant> [--keyword <optional package hint>]`
  - Package detail and package params: `bytedcli --json safe puzzle pkg get --tenant <tenant> --id <selected package id>`
  - Package-bound Puzzle feature candidates: `bytedcli --json safe puzzle pkg list-features --tenant <tenant> --id <selected package id> [--keyword <optional feature hint>]`
  - Puzzle feature detail: `bytedcli --json safe puzzle feature get --tenant <tenant> --id <selected feature id>`
  - Puzzle feature dependencies and package input params: `bytedcli --json safe puzzle feature list-dependencies --tenant <tenant> --id <selected feature id> --collection-code <selected package code> [--instance-code <selected item code>]`
  - Disposal feature binding candidates: `bytedcli --json safe disposal feature list --platform-type <n> --scene-id <n> [--keyword <feature-key-or-name>]`
- The underlying Safe/Puzzle APIs are authenticated, but the authentication source is bytedcli's Safe client. Run `bytedcli auth login --session` and `bytedcli safe login` when login is missing. Do not read bytedcli session files or hand-build curl requests.
- If a required creation argument cannot be uniquely derived from the CLI discovery output, ask the user for the exact final value. Do not invent values.
- Do not run Puzzle package/feature discovery until the exact Puzzle tenant code has been confirmed by the user. For example, do not translate "直播租户" to `live`; ask for the tenant code or show tenant candidates and let the user choose.
- For `feature create-puzzle`, treat `--pkg-code`, `--puzzle-feature-key`, `--item-code`, `--value-type`, and `--pkg-param` as final CLI arguments produced by discovery. Query Puzzle package candidates from the tenant. If the package candidate list is empty, ask for a narrow package or feature hint in plain business language. If more than one package candidate remains, stop and ask the user to choose the package. Do not call `pkg list-features` until exactly one package has been selected or explicitly confirmed by the user. Do not iterate across multiple unconfirmed package candidates to search for features.
- For `feature create-puzzle`, derive the final creation arguments from the selected CLI discovery results: use the selected package `code` as `--pkg-code`, the selected Puzzle feature `code` as `--puzzle-feature-key`, the selected feature's entity/item code (for example `entity_code=room`) as `--item-code`, the selected feature's unique value type as `--value-type`, and package/dependency params as the required left-side keys for repeatable `--pkg-param`. Ignore deprecated `feat_params`. If a required field is missing from the CLI discovery output, ask the user for the final value.
- For `feature create-puzzle`, do not ask the user to manually type `--value-type` when the selected Puzzle feature option exposes a unique feature value type. The Agent should fill `--value-type` for the CLI.
- For engineering users, resolve PkgParams best-effort, run `--dry-run --json`, show the final feature payload and all bindings, and ask the engineer to confirm before creating the ticket with `--yes`. Prefer exact `live_id=live_id` and `room_id=room_id`. Treat `target_id` as the current disposal object ID; when a Puzzle param represents a unique entity/object identifier, recommend mapping it to `target_id` when appropriate. For other params, make a reasonable recommendation from the current-scene feature candidates, then rely on the engineer's dry-run confirmation.
- For operations users, do not show raw dry-run payloads or ask them to review low-level CLI parameters. Resolve only business-safe PkgParams automatically, ask business-readable questions when needed, create the approval ticket with `--yes` after the business choices are clear, and return the approval URL directly.
- For operations users, PkgParams binding policy is strict: auto-bind only `live_id=live_id` and `room_id=room_id` when those exact params appear.
- For operations users, recommend binding through `target_id` only when exactly one Puzzle param remains and that value is the unique identifier of the object being disposed. The Puzzle param does not have to be literally named `target_id`; examples include a single `ip` param for an IP-location feature, `comment_id`, `user_id`, or another entity ID. In that case, explain in business language that `target_id` means "the current disposal object ID", propose the concrete mapping such as `ip=target_id`, and ask the operations user to confirm.
- For operations users, if multiple non-auto params remain, or the remaining param is not clearly a unique disposal-object identifier, stop and tell the operations user that this feature contains fields requiring engineering support, then ask them to find an engineer.
- If Puzzle package, Puzzle feature, item code, or param binding has multiple candidates or no safe default, ask the user. Do not guess. The CLI intentionally only accepts final values.
- `feature create-puzzle` also selects all optional-operator nodes and fills each node with the frontend default operators for the selected `value-type`.
- `feature create-puzzle` does not support or submit deprecated `feat_params`.
- Default operator mapping by `value-type`: `int`/`float` use `eq,ne,gt,lt,ge,le,in,not_in,range`; `string` uses `eq,ne,in,not_in`; `bool` uses `eq`; `int_arr`/`string_arr` use `multi_in,multi_not_in,multi_must_eq`. If a value type is outside this mapping, ask for clarification instead of guessing.
- `feature copy` first queries the source feature within `from-platform-type + from-scene-id`, then creates a publish ticket for `to-platform-type + to-scene-id`.
  - Do not modify copied feature fields except the destination `platform_type_enum` and `scene_id_enum`, which must reflect the target scope. Do not submit the source feature `id` when creating the copy ticket.
- `ability copy` first queries the source action reference within `from-platform-type + from-scene-id`, then creates a publish ticket for `to-scene-id`. `from-platform-type` and `to-platform-type` must be identical.
  - Do not copy by `action_key`; one `action_key` can have multiple action references under a platform and scene. Use exact `action_register_key`.
  - Do not submit the source action reference `id` or `action_register_key` when creating the copy ticket; the backend generates both fields.
- After any successful `feature copy`, `feature create-request`, `feature create-puzzle`, or `ability copy`, do not stop at saying the operation succeeded. Extract the returned `url`, or build `https://safe.bytedance.net/dev_portal/live/punish-dev-admin/publish-process/detail?id=<id>` from the returned ticket `id`, then explicitly send that URL to the user and tell them to approve the publish ticket there.

## Authentication

Use the regular Safe login flow before querying:

```bash
bytedcli auth login --session
bytedcli safe login
```

If a Safe cookie is already available:

```bash
bytedcli safe login --cookie "session=xxx"
```
