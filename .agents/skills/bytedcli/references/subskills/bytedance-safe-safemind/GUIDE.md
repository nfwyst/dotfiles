---
name: bytedance-safe-safemind
description: SafeMind AI reasoning model, graph lifecycle, node unit test, and trace operations via bytedcli safe domain. Use when listing SafeMind models, creating or querying graph instances, copying, updating, deleting, publishing, or rolling back graph versions, triggering workflow tests or node unit tests, or tracing execution node states and durations.
---

# Safe SafeMind — Model, Graph & Trace

SafeMind AI reasoning 引擎的模型列表查询、图实例创建/查询/拷贝/更新/删除、草稿图发布、图版本回滚、工作流测试、单节点试运行和 trace 分析。

## Authentication

Requires Safe authentication. See parent skill `bytedance-safe` for login instructions.

## Commands

### model list

List SafeMind models.

```bash
# Basic usage
bytedcli safe safemind model list

# Filter by keyword (maps to backend pattern)
bytedcli safe safemind model list --keyword doubao

# Filter by endpoint or scene
bytedcli safe safemind model list --endpoint <endpoint> --scene-id 0

# With tenant and pagination
bytedcli safe safemind model list --tenant tcs --page 2 --page-size 20

# JSON output
bytedcli --json safe safemind model list --keyword demo
```

Parameters:
- `--tenant <code>` — Tenant code (from config or `--tenant` override)
- `--keyword <kw>` — Model name keyword, mapped to backend `pattern`
- `--endpoint <endpoint>` — Filter by model endpoint
- `--scene-id <id>` — Filter by scene ID (supports `0`)
- `--page <n>` — Page number (default: `1`)
- `--page-size <n>` — Items per page (default: `10`)

Backend fixed parameters:
- `is_admin_page=true`
- `need_relation=false`
- `with_ark_status=true`

### graph create

Create a SafeMind graph instance.

```bash
# Basic usage
bytedcli safe safemind graph create --key <graph-instance-key> --desc <description>

# With optional name and explicit description alias
bytedcli safe safemind graph create --tenant tcs --key <key> --name <graph-name> --description <description> --user-type online --workflow-mode 1

# JSON output
bytedcli --json safe safemind graph create --key <key> --desc <description>
```

Parameters:
- `--tenant <code>` — Tenant code (from config or `--tenant` override)
- `--key <key>` — Graph instance unique key [required]
- `--name <text>` — Graph instance name, mapped to backend `name` [optional]
- `--desc <text>` / `--description <text>` — Graph instance description, mapped to backend `description` [required]
- `--platform <platform>` — Graph platform (default: `SafeMind`)
- `--user-type <type>` — User type: `online` or `test` (default: `test`)
- `--workflow-mode <mode>` — Workflow mode: `0` for workflow, `1` for dialogue flow (default: `0`)

Backend fixed parameters:
- `content` is sent as the built-in input/output-node DSL template
- `safe_mind_features={"features":[]}`

### graph get

Get graph instance with full DSL content.

```bash
# Basic usage
bytedcli safe safemind graph get --key <graph-instance-key>

# With version
bytedcli safe safemind graph get --key <graph-instance-key> --version 1

# With tenant
bytedcli safe safemind graph get --tenant tcs --key <key> --version 1

# JSON output
bytedcli --json safe safemind graph get --key <key>
```

Parameters:
- `--tenant <code>` — Tenant code (from config or --tenant override)
- `--key <key>` — Graph instance unique key [required]
- `--version <n>` — Version number (default: 1)

### graph copy

Copy a graph instance into a new graph key.

```bash
# Basic usage
bytedcli safe safemind graph copy --from-id 1001 --to-key <new-graph-instance-key>

# Without source ID (backend receives from_graph_instance_id=0)
bytedcli safe safemind graph copy --from-key <source-key> --from-version 3 --to-key <new-key>

# With source metadata and tenant
bytedcli safe safemind graph copy --tenant tcs --from-key <source-key> --from-version 3 --to-key <new-key> --platform 1 --use-type test --copy-deeply true --scene <scene-key>

# JSON output
bytedcli --json safe safemind graph copy --from-key <source-key> --from-version 3 --to-key <new-key> --copy-deeply false
```

Parameters:
- `--tenant <code>` — Tenant code (from config or `--tenant` override)
- `--from-id <id>` — Source graph instance ID [optional, defaults to `0` when omitted]
- `--from-key <key>` — Source graph instance key [required when `--from-id` is omitted]
- `--from-version <n>` — Source graph instance version [required when `--from-id` is omitted]
- `--to-key <key>` — New graph instance key [required]
- `--platform <n>` — Platform enum value (default: `1` for SafeMind)
- `--use-type <type>` — Use type: `online` or `test` (default: `test`)
- `--copy-deeply <boolean>` — Whether to deeply copy graph dependencies (default: `true`)
- `--scene <key>` — Scene key [optional]

### graph update

Update a draft graph instance version.

```bash
# Update from local JSON file
bytedcli safe safemind graph update --key <graph-instance-key> --version 3 --content ./graph.json

# Update with explicit workflow config and extra metadata
bytedcli safe safemind graph update --tenant tcs --key <key> --version 3 --content '{"root":"input_node","nodes":[],"edges":[]}' --workflow-config '' --extra '{"operator":"demo-user"}'

# JSON output
bytedcli --json safe safemind graph update --key <key> --version 3 --content ./graph.json --ignore-check-content false
```

Parameters:
- `--tenant <code>` — Tenant code (from config or `--tenant` override)
- `--key <key>` — Graph instance unique key [required]
- `--version <n>` — Draft version number to update [required]
- `--content <json-or-file>` — Graph DSL JSON string or local JSON file path [required]
- `--workflow-config <text>` — Workflow config string [optional]
- `--extra <json>` — Extra metadata JSON string [optional]
- `--ignore-check-content <boolean>` — Whether to ignore content validation (default: `true`)

Notes:
- Only draft graph versions can be updated by the backend API.
- `--content` accepts either inline JSON or a local JSON file path.

### graph delete

Delete a draft graph instance version.

```bash
# Basic usage
bytedcli safe safemind graph delete --key <graph-instance-key> --version 3

# With tenant
bytedcli safe safemind graph delete --tenant tcs --key <key> --version 3

# JSON output
bytedcli --json safe safemind graph delete --key <key> --version 3
```

Parameters:
- `--tenant <code>` — Tenant code (from config or `--tenant` override)
- `--key <key>` — Graph instance unique key [required]
- `--version <n>` — Draft version number to delete [required]

Notes:
- Only draft graph versions can be deleted by the backend API.

### graph publish

Publish a draft graph instance version.

```bash
# Basic usage
bytedcli safe safemind graph publish --key <graph-instance-key> --version 3

# With tenant
bytedcli safe safemind graph publish --tenant tcs --key <key> --version 3

# JSON output
bytedcli --json safe safemind graph publish --key <key> --version 3
```

Parameters:
- `--tenant <code>` — Tenant code (from config or `--tenant` override)
- `--key <key>` — Graph instance unique key [required]
- `--version <n>` — Draft version number to publish [required]

### graph rollback

Rollback a graph instance to a target version.

```bash
# Basic usage
bytedcli safe safemind graph rollback --key <graph-instance-key> --rollback-version 2

# With tenant
bytedcli safe safemind graph rollback --tenant tcs --key <key> --rollback-version 2

# JSON output
bytedcli --json safe safemind graph rollback --key <key> --rollback-version 2
```

Parameters:
- `--tenant <code>` — Tenant code (from config or `--tenant` override)
- `--key <key>` — Graph instance unique key [required]
- `--rollback-version <n>` — Target graph version to roll back to [required]

### graph test

Trigger a workflow test for a graph instance and poll until all nodes complete.

```bash
# Basic usage
bytedcli safe safemind graph test --key <graph-instance-key> --version 3 --params '{"message":"hello"}'

# With structured params
bytedcli safe safemind graph test --tenant tcs --key <key> --version 3 --params '{"p_int":100,"p_string":"200"}'

# JSON output
bytedcli --json safe safemind graph test --key <key> --version 3 --params '{"message":"hello"}'
```

Parameters:
- `--tenant <code>` — Tenant code
- `--key <key>` — Graph instance unique key [required]
- `--version <n>` — Graph instance version to test [required]
- `--params <json>` — Workflow test params as JSON object string [required]

### graph test-node

Run a unit test for one graph node with explicit params and DSL JSON.

```bash
# Basic usage
bytedcli safe safemind graph test-node --key <graph-instance-key> --node-key <node-key> --params ./sample-params.json --dsl ./sample-dsl.json

# Inline params and file-based DSL
bytedcli safe safemind graph test-node --tenant tcs --key <key> --version 1 --node-key <node-key> --params '{"title":"demo"}' --dsl ./sample-dsl.json

# JSON output
bytedcli --json safe safemind graph test-node --key <key> --node-key <node-key> --params ./sample-params.json --dsl ./sample-dsl.json
```

Parameters:
- `--tenant <code>` — Tenant code
- `--key <key>` — Graph instance unique key [required]
- `--version <n>` — Graph instance version (default: `1`)
- `--node-key <key>` — Target node key [required]
- `--params <json-or-file>` — Node input params JSON object string or local JSON file path [required]
- `--dsl <json-or-file>` — Graph DSL JSON object string or local JSON file path [required]

### graph validate

Validate graph content without persisting changes.

```bash
# Basic usage
bytedcli safe safemind graph validate --key <graph-instance-key> --version 1 --content ./graph.json

# With inline JSON content
bytedcli safe safemind graph validate --key <graph-instance-key> --version 1 --content '{"root":"input_node","nodes":[],"edges":[]}'

# With tenant and graph-mode
bytedcli safe safemind graph validate --tenant tcs --key <key> --version 1 --content ./graph.json --graph-mode workflow

# JSON output
bytedcli --json safe safemind graph validate --key <key> --version 1 --content ./graph.json
```

Parameters:
- `--tenant <code>` — Tenant code (from config or `--tenant` override)
- `--key <key>` — Graph instance unique key [required]
- `--version <n>` — Graph instance version [required]
- `--content <json-or-file>` — Graph DSL JSON string or local JSON file path [required]
- `--graph-mode <mode>` — Graph mode: agent, workflow, chatflow, workflow-chatflow, container (default: `workflow`)

Notes:
- Validates graph content against SafeMind backend rules without persisting any changes.
- `--content` accepts either inline JSON or a local JSON file path.

### trace get

Get trace with node states and execution details.

```bash
# Basic usage
bytedcli safe safemind trace get --trace-id <trace-id>

# With graph instance key
bytedcli safe safemind trace get --trace-id <id> --key <graph-instance-key>

# Include DSL content in text output
bytedcli safe safemind trace get --trace-id <id> --with-dsl

# JSON output (always includes all fields including dsl_content)
bytedcli --json safe safemind trace get --trace-id <id>
```

Parameters:
- `--tenant <code>` — Tenant code
- `--trace-id <id>` — Trace unique ID [required]
- `--key <key>` — Graph instance key [optional]
- `--with-dsl` — Include full DSL content (graph name, root, nodes, edges) in text output [optional, default: off]

## Output Formats

- **Text mode** (default): `model list` renders a table view; `graph get`, `graph copy`, `graph update`, `graph delete`, `graph publish`, `graph rollback`, `graph test`, `graph test-node`, and `trace get` render human-readable summaries. Use `--with-dsl` to also show graph structure details (name, root, node/edge counts).
- **JSON mode** (`-j`/`--json`): Returns structured JSON with all fields. `graph test` includes expanded `graph_ctx`; `graph test-node` includes raw and best-effort parsed node result fields; `trace get` includes `dsl_content` by default unless the response has no trace infos. To omit `dsl_content` from JSON, process the output externally.
