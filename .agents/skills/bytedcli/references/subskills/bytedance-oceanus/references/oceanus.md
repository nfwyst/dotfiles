# Oceanus (DataLeap) CLI Reference

Oceanus is part of the DataLeap platform for global node drafting, multi-region scheduling, and dependency management. This CLI provides commands to browse project trees, inspect node drafts, create or update Oceanus nodes, and infer or apply dependency recommendations.

Oceanus uses the fixed site `i18n-tt`. Oceanus commands target this site; other cloud sites are unsupported.

Built-in scheduling regions commonly referenced in this repo include `US-East`, `Singapore`, `US-EastRed`, `EU-Compliance2`, `EU-TTP2`, and `US-TTP` (the same set appears in `bytedcli` `--region` help). The platform may use additional region names; align with the Oceanus IDE or `local-refine-status` output.

## Supported Command Groups

`bytedcli oceanus --help` exposes 4 top-level command groups:

- `project`: `list` / `get` / `local list` / `search`
- `tree-node`: `get` / `list` / `search`
- `node`: `create` / `get` / `code get` / `draft list` / `draft update` / `draft test` / `draft explain` / `commit` / `save-dispatch` / `delete` / `region create` / `region add` / `region delete` / `global-node-uid get` / `local-task-id get` / `local-refine-status list` / `online-remote get` / `review-match list`
- `task`: `search` / `bind-node get` / `dependency-recommendation get` / `dependency-recommendation apply`

## Authentication

Check auth first:

```bash
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli auth status
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli auth login
```

If a page-mode Oceanus endpoint requires browser-session cookies during local debugging, you can temporarily inject them:

```bash
export BYTEDCLI_OCEANUS_COOKIE='session_cookie=...; passport_cookie=...'
```

## Commands

### project list

List Oceanus projects accessible to the current user.

```bash
bytedcli oceanus project list
```

JSON output includes `projects`, `total`, `page`, and `page_size`.

---

### project get

Get Oceanus project details by project ID.

```bash
bytedcli oceanus project get --project-id <projectId>
```

**Options:**

- `--project-id <projectId>` - Project ID (required)

**Example:**

```bash
bytedcli oceanus project get --project-id 123
```

---

### project param list

List Oceanus project params by project ID.

```bash
bytedcli oceanus project param list --project-id <projectId>
```

JSON output includes `projectId`, `params`, `total`, `page`, and `page_size`.

**Options:**

- `--project-id <projectId>` - Project ID (required)

**Example:**

```bash
bytedcli oceanus project param list --project-id 123
```

---

### project local list

List local project mappings for each region under a global Oceanus project.

```bash
bytedcli oceanus project local list --project-id <projectId>
```

**Options:**

- `--project-id <projectId>` - Project ID (required)

**Example:**

```bash
bytedcli oceanus project local list --project-id 123
```

---

### project search

Search Oceanus projects by keyword.

```bash
bytedcli oceanus project search [options]
```

**Options:**

- `--keyword <keyword>` - Project keyword (required)
- `--page <page>` - Positive integer page number
- `--page-size <pageSize>` - Positive integer page size

**Example:**

```bash
bytedcli oceanus project search --keyword demo --page 1 --page-size 20
```

---

### tree-node list

List direct children under one or more tree URIs, or start from a node UID and let the CLI resolve its URI automatically. Use only `--uri` for URI input; repeat it or pass comma-separated values for batch queries.

```bash
bytedcli oceanus tree-node list [options]
```

**Options:**

- `--project-id <projectId>` - Project ID (required)
- `--node-id <nodeId>` - Resolve a node UID to its URI before querying children
- `--uri <uri>` - Parent URI to query (repeat or comma separate for batch; defaults to `task:///`)
- `--max-depth <maxDepth>` - Maximum traversal depth (default: `1`)
- `--all` - Recursively traverse until all reachable leaf nodes are fetched

**Examples:**

```bash
bytedcli oceanus tree-node list --project-id 123
bytedcli oceanus tree-node list --project-id 123 --node-id NdemoDir
bytedcli oceanus tree-node list --project-id 123 --uri task:///sample-dir
bytedcli oceanus tree-node list --project-id 123 --uri task:///,task:///NdemoDir
bytedcli oceanus tree-node list --project-id 123 --uri task:/// --uri task:///NdemoDir
bytedcli oceanus tree-node list --project-id 123 --max-depth 3
bytedcli oceanus tree-node list --project-id 123 --node-id NdemoDir --all
bytedcli oceanus tree-node list --project-id 123 --all
```

---

### tree-node search

Search Oceanus tree nodes by metadata and/or code content.

```bash
bytedcli oceanus tree-node search [options]
```

**Options:**

- `--project-id <projectId>` - Project ID (required)
- `--keyword <keyword>` - Search keyword (required)
- `--search-scope <scopes>` - Comma-separated scopes: `metadata`, `content` (default: `metadata,content`)
- `--owner <owner>` - Owner filter
- `--limit <limit>` - Positive integer limit for returned rows

**Examples:**

```bash
bytedcli oceanus tree-node search --project-id 123 --keyword demo
bytedcli oceanus tree-node search --project-id 123 --keyword demo --search-scope metadata
```

---

### tree-node get

Get a single tree node by `nodeUid`.

```bash
bytedcli oceanus tree-node get --node-id <nodeId>
```

**Options:**

- `--node-id <nodeId>` - Tree node UID (required)

**Example:**

```bash
bytedcli oceanus tree-node get --node-id NdemoNode
```

---

### node create

Create an Oceanus node and, when draft content or metadata is provided, update the draft in a follow-up call. If multiple regions are requested, the CLI creates the node, updates the draft, then calls `region create` for the remaining regions.

```bash
bytedcli oceanus node create [options]
```

**Options:**

- `--project-id <projectId>` - Project ID (required)
- `--name <name>` - Node name
- `--parent-uri <parentUri>` - Parent URI
- `--type <type>` - Node type, e.g. `hsql`, `dir`, `resource`
- `--content <content>` - Initial content
- `--content-file <path>` - Read initial content from a file
- `--code-mode <mode>` - `coalesce` or `split`
- `--region <region>` - Target regions to initialize (repeat or comma-separated; common: US-East, Singapore, US-EastRed, EU-Compliance2, EU-TTP2, US-TTP)
- `--description <description>` - Node description
- `--file <file>` - Resource file field for resource nodes
- `--metadata-json <json>` - Metadata JSON object
- `--param <key=value>` - Extra request body field
- `--param-json <key=json>` - Extra JSON request body field (repeatable; do not comma-separate JSON values)
- `--body-json <json>` - Full create-node request body

**Examples:**

```bash
# Create a coalesce HSQL node
bytedcli oceanus node create --project-id 123 --name demo-node --parent-uri task:/// --type hsql --content 'select 1' --code-mode coalesce

# Create a split HSQL node
bytedcli oceanus node create --project-id 123 --name demo-node-split --parent-uri task:/// --type hsql --content 'select 1' --code-mode split

# Create and initialize multiple regions
bytedcli oceanus node create --project-id 123 --name demo-node-all --parent-uri task:/// --type hsql --content 'select 1' --region US-East,Singapore,US-EastRed,EU-Compliance2,EU-TTP2,US-TTP

# Create a directory
bytedcli oceanus node create --project-id 123 --name sample-dir --parent-uri task:///sample-parent --type dir
```

**Notes:**

- With code content and no explicit `--region`, Oceanus defaults to `US-East`.
- `--type dir` usually does not need `--content`, `--code-mode`, or `--region`.

---

### node get

Get the current Oceanus node draft.

```bash
bytedcli oceanus node get [options]
```

**Options:**

- `--node-id <nodeId>` - Node UID (required)
- `--legacy` - Use the legacy draft endpoint

**Examples:**

```bash
bytedcli oceanus node get --node-id NdemoNode
bytedcli oceanus node get --node-id NdemoNode --legacy
```

---

### node code get

Get the effective Oceanus node code from the current draft.

```bash
bytedcli oceanus node code get [options]
```

**Options:**

- `--node-id <nodeId>` - Node UID (required)
- `--region <region>` - Region used for split-mode lookup or coalesce placeholder expansion; required for split-mode nodes (common: US-East, Singapore, US-EastRed, EU-Compliance2, EU-TTP2, US-TTP)

**Examples:**

```bash
# Coalesce: expand placeholders for the requested region
bytedcli oceanus node code get --node-id NdemoNode --region US-East

# Split: read the target region code
bytedcli oceanus node code get --node-id NsplitNode --region Singapore
```

**Notes:**

- `coalesce` mode reads top-level draft code and expands `@{...}` placeholders when `--region` is provided.
- `split` mode requires `--region`, prefers `taskConf.code` for the target region, then falls back to `taskConf.conf.configuration.operator.parameter.code`.

---

### node draft list

List draft versions for a node.

```bash
bytedcli oceanus node draft list [options]
```

**Options:**

- `--node-id <nodeId>` - Node UID (required)
- `--page <page>` - Positive integer page number
- `--page-size <pageSize>` - Positive integer page size

**Example:**

```bash
bytedcli oceanus node draft list --node-id NdemoNode --page 1 --page-size 20
```

---

### node draft update

Update an Oceanus node draft.

```bash
bytedcli oceanus node draft update [options]
```

**Options:**

- `--node-id <nodeId>` - Node UID (required)
- `--content <content>` - Draft content
- `--content-file <path>` - Read draft content from a file
- `--metadata-json <json>` - Draft metadata JSON object
- `--param <key=value>` - Extra request body field
- `--param-json <key=json>` - Extra JSON request body field (repeatable; do not comma-separate JSON values)
- `--body-json <json>` - Full update request body

**Examples:**

```bash
bytedcli oceanus node draft update --node-id NdemoNode --content 'select 2'
bytedcli oceanus node draft update --node-id NdemoNode --content-file ./sample.sql --metadata-json '{"owner":"sample-user"}'
```

---

### node draft explain

Explain or validate an Oceanus node draft for a target region via `POST /datalab/v1/ide/nodes/{nodeId}/explain` on the Oceanus `dorado-global-api` host.

```bash
bytedcli oceanus node draft explain [options]
```

**Options:**

- `--node-id <nodeId>` - Global node UID in the request path (required)
- `--region <region>` - Target region to explain against (required unless `--body-json` includes `region`; common: US-East, Singapore, US-EastRed, EU-Compliance2, EU-TTP2, US-TTP)
- `--command <command>` - Explain command type (default: `code`)
- `--table-commit-ids-json <json>` - JSON array of table commit IDs (default: `[]`)
- `--prod-env` - Use production Hive environment
- `--param <key=value>` - Extra request body field
- `--param-json <key=json>` - Extra JSON request body field (repeatable; do not comma-separate JSON values)
- `--body-json <json>` - Full explain request body

**Notes:**

- The default request shape is `{"command":"code","region":"...","tableCommitIds":[],"prodEnv":false}`.
- A successful response returns `status`, `hints`, and optional `result`.

**Examples:**

```bash
bytedcli oceanus node draft explain --node-id NdemoNode --region Singapore
bytedcli oceanus node draft explain --node-id NdemoNode --region Singapore --body-json '{"command":"code","region":"Singapore","tableCommitIds":[],"prodEnv":false}'
```

---

### node commit

Commit (publish) an Oceanus node across configured regions. The request is sent to `POST /datalab/v1/ide/nodes/{nodeUid}/commit` on the Oceanus `dorado-global-api` host.

```bash
bytedcli oceanus node commit [options]
```

**Options:**

- `--node-id <nodeId>` - Node UID (required)
- `--project-id <projectId>` - Oceanus project ID
- `--create-user <user>` - Commit submitter username
- `--type <type>` - Node type, for example `hsql`
- `--no-auto-release` - Disable auto-release after commit
- `--skip-codes <codes>` - Skip specific error codes during commit
- `--region-configs-json <json>` - JSON array of per-region commit configs (`region`, `taskId`, `commitConf`, `tags`, optional `review`)
- `--baseline-setting-json <json>` - Baseline setting JSON object
- `--param <key=value>` - Extra request body field
- `--param-json <key=json>` - Extra JSON request body field (repeatable; do not comma-separate JSON values)
- `--body-json <json>` - Full POST `/commit` request body (`autoRelease`, `createUser`, `projectId`, `regionConfigs`, `baselineSetting`, `type`, `skipCodes`)

**Notes:**

- Each `regionConfigs` entry typically includes `region`, `taskId`, `commitConf` (JSON string), `tags`, and optional `review`.
- `commitConf` carries `reviewPolicyId`, `openDefaultSystemAlarm`, `customAlarmRuleIds`, `baselineIds`, and the regional `projectId`.

**Examples:**

```bash
bytedcli oceanus node commit --node-id NdemoNode --project-id 123 --type hsql --region-configs-json '[{"region":"US-East","commitConf":"{}","taskId":"1001","tags":[]}]'
bytedcli oceanus node commit --node-id NdemoNode --body-json '{"autoRelease":true,"createUser":"sample-user","projectId":123,"regionConfigs":[{"region":"US-East","commitConf":"{\"reviewUserNames\":[],\"reviewPolicyId\":1,\"openDefaultSystemAlarm\":true,\"customAlarmRuleIds\":[],\"baselineIds\":[],\"projectId\":124}","taskId":"1001","tags":[]},{"region":"Singapore","review":{"reviewers":[],"reviewPolicyId":-1},"commitConf":"{\"reviewUserNames\":[],\"reviewPolicyId\":-1,\"openDefaultSystemAlarm\":true,\"customAlarmRuleIds\":[10001],\"baselineIds\":[],\"projectId\":125}","taskId":"1002","tags":[]}],"baselineSetting":{},"type":"hsql","skipCodes":""}'
```

---

### node save-dispatch

Persist regional dispatch metadata for a global node via `POST /datalab/v1/ide/nodes/{nodeUid}/saveDispatch` on the Oceanus `dorado-global-api` host. Success responses use the same `status` / `hints` / `result` shape as `node commit`; `result` is typically a JSON string containing `region` and `taskId`.

```bash
bytedcli oceanus node save-dispatch [options]
```

**Options:**

- `--node-id <nodeId>` - Global node UID in the path (required)
- `--region <region>` - Target scheduling region (merged into the JSON body; required unless `region` is set in `--body-json` or `--param`; common: US-East, Singapore, US-EastRed, EU-Compliance2, EU-TTP2, US-TTP)
- `--param <key=value>` - Extra request body field
- `--param-json <key=json>` - Extra JSON request body field (repeatable)
- `--body-json <json>` - Full request body (must include `region` if `--region` is omitted)

**Examples:**

```bash
bytedcli oceanus node save-dispatch --node-id NdemoNode --region US-East
bytedcli oceanus node save-dispatch --node-id NdemoNode --body-json '{"region":"US-East"}'
```

---

### node local-refine-status list

Get local refine status across regions for a global node.

```bash
bytedcli oceanus node local-refine-status list --node-id <nodeId>
```

**Options:**

- `--node-id <nodeId>` - Node UID (required)

**Example:**

```bash
bytedcli oceanus node local-refine-status list --node-id NdemoNode
```

---

### node online-remote get

Get the online remote view for a node. Text mode prints a structured summary and formatted payload; use `-j` for raw JSON.

```bash
bytedcli oceanus node online-remote get --node-id <nodeId>
```

**Options:**

- `--node-id <nodeId>` - Node UID (required)

---

### node review-match list

Get review policy match results for a node.

```bash
bytedcli oceanus node review-match list --node-id <nodeId>
```

**Options:**

- `--node-id <nodeId>` - Node UID (required)

---

### node delete

Delete an Oceanus node.

```bash
bytedcli oceanus node delete --node-id <nodeId>
```

**Options:**

- `--node-id <nodeId>` - Node UID (required)

**Important:** confirm with the user before executing delete operations.

---

### node global-node-uid get

Get global Oceanus node UIDs from local Dorado task IDs.

```bash
bytedcli oceanus node global-node-uid get [options]
```

**Options:**

- `--local-task-id <taskId>` - Local task ID (repeat or comma-separated)
- `--region <region>` - Region (required when `--local-task-id` is provided; common: US-East, Singapore, US-EastRed, EU-Compliance2, EU-TTP2, US-TTP)
- `--param <key=value>` - Extra request body field
- `--param-json <key=json>` - Extra JSON request body field (repeatable; do not comma-separate JSON values)
- `--body-json <json>` - Full request body

---

### node local-task-id get

Get local task IDs from a global Oceanus node UID.

```bash
bytedcli oceanus node local-task-id get [options]
```

**Options:**

- `--global-node-uid <nodeUid>` - Global node UID (repeat or comma-separated)
- `--param <key=value>` - Extra request body field
- `--param-json <key=json>` - Extra JSON request body field (repeatable; do not comma-separate JSON values)
- `--body-json <json>` - Full request body

---

### node region create

Add scheduling regions to an existing node.

```bash
bytedcli oceanus node region create [options]
```

**Options:**

- `--node-id <nodeId>` - Node UID (required)
- `--region <region>` - Region to add (repeat or comma-separated; common: US-East, Singapore, US-EastRed, EU-Compliance2, EU-TTP2, US-TTP)
- `--param <key=value>` - Extra request body field
- `--param-json <key=json>` - Extra JSON request body field (repeatable; do not comma-separate JSON values)
- `--body-json <json>` - Full request body

**Example:**

```bash
bytedcli oceanus node region create --node-id NdemoNode --region US-East,Singapore
```

---

### node region add

Append region task entries on an existing node via `POST /datalab/v1/ide/nodes/{nodeUid}/addRegions` on the Oceanus `dorado-global-api` host.

Request body shapes:

- JSON object with a `tasks` array (each item includes `region` and the server field `taskMaping`, optionally `taskId` and other fields).
- Top-level JSON array of task records (sent as the raw POST body). Do not combine this with `--region` or `--param` / `--param-json`.

When using `--region`, the CLI builds `tasks[]` with `taskMaping` from `--task-mapping` (default `create`, e.g. `select` for other flows) and optional `taskId` from `--task-id`.

```bash
bytedcli oceanus node region add [options]
```

**Options:**

- `--node-id <nodeId>` - Node UID (required)
- `--region <region>` - Regions for generated `tasks[]` entries (repeat or comma-separated; common: US-East, Singapore, US-EastRed, EU-Compliance2, EU-TTP2, US-TTP)
- `--task-mapping <mode>` - Value written as `taskMaping` on each generated task (default: `create`)
- `--task-id <taskId>` - When using `--region`, set this numeric `taskId` on each generated task entry
- `--param <key=value>` - Extra request body field (object body only)
- `--param-json <key=json>` - Extra JSON request body field (repeatable; object body only)
- `--body-json <json>` - JSON object (e.g. `{"tasks":[...]}`) or JSON array of task records (raw body)

**Example:**

```bash
bytedcli oceanus node region add --node-id NdemoNode --region US-East
bytedcli oceanus node region add --node-id NdemoNode --region US-East --task-mapping select --task-id 109124267
bytedcli oceanus node region add --node-id NdemoNode --body-json '{"tasks":[{"region":"US-East","taskMaping":"create"}]}'
bytedcli oceanus node region add --node-id NdemoNode --body-json '[{"region":"US-East","taskMaping":"select","taskId":109124267}]'
```

---

### node region delete

Remove one scheduling region from a node.

```bash
bytedcli oceanus node region delete [options]
```

**Options:**

- `--node-id <nodeId>` - Node UID (required)
- `--region <region>` - Region to remove (common: US-East, Singapore, US-EastRed, EU-Compliance2, EU-TTP2, US-TTP)
- `--param <key=value>` - Extra request body field
- `--param-json <key=json>` - Extra JSON request body field (repeatable; do not comma-separate JSON values)
- `--body-json <json>` - Full request body

---

### node draft test

Run multi-region Oceanus node draft debug tests against `PUT /datalab/task/{nodeId}/draft/test?taskId=...&projectId=...` on the Oceanus `dorado-global-api` host.

```bash
bytedcli oceanus node draft test [options]
```

**Options:**

- `--node-id <nodeId>` - Global node UID in the request path (required)
- `--task-id <taskId>` - Regional task ID in the query string (required)
- `--project-id <projectId>` - Project ID (required)
- `--body-json <json>` - JSON array of per-region draft test payloads; each `conf` string must include `configuration.operator.parameter.code`

**Notes:**

- Each body item typically includes `type`, `scheduleDateTimes`, `cluster`, `queue`, `dc`, `region`, `hubRegion`, `taskId`, and `conf`.
- `conf` is a JSON string; `configuration.operator.parameter.code` is the SQL or debug script to run.

**Example:**

```bash
bytedcli oceanus node draft test --node-id NdemoNode --task-id 1001 --project-id 123 --body-json '[{"type":"hsql","scheduleDateTimes":["2026-05-09 00:00:00"],"cluster":"demo-cluster","queue":"root.demo_queue","dc":"demo-dc","region":"sg","hubRegion":"Singapore","taskId":"NdemoNode","conf":"{\"configuration\":{\"operator\":{\"parameter\":{\"code\":\"select 1 from sample_db.sample_table\",\"engineType\":\"spark\"},\"type\":\"hsql\"}},\"type\":\"hsql\"}"}]'
```

---

### task search

Search legacy tasks by explicit options or a raw query object.

```bash
bytedcli oceanus task search [options]
```

**Options:**

- `--project-id <projectId>` - Project ID
- `--region <region>` - Scheduling region (US-East, Singapore, US-EastRed, EU-Compliance2, EU-TTP2, US-TTP, …)
- `--keyword <keyword>` - Keyword
- `--task-types <taskTypes>` - Comma-separated task types
- `--page <page>` - Page number (1-based)
- `--page-size <pageSize>` - Page size
- `--query-json <json>` - Full query JSON object

**Notes:**

- Unless `--query-json` is provided, `--project-id`, `--region`, and `--keyword` are required together.
- Use `--page` and `--page-size` for standard pagination; explicit flags override `pageNo` / `pageSize` inside `--query-json`.

---

### task bind-node get

Query legacy task to global node binding.

```bash
bytedcli oceanus task bind-node get [options]
```

**Options:**

- `--region <region>` - Scheduling region (US-East, Singapore, US-EastRed, EU-Compliance2, EU-TTP2, US-TTP, …)
- `--task-id <taskId>` - Task ID
- `--query-json <json>` - Full query JSON object

---

### task dependency-recommendation get

Infer dependencies for the current node and region from the resolved regional SQL.

```bash
bytedcli oceanus task dependency-recommendation get [options]
```

**Options:**

- `--node-id <nodeId>` - Node UID
- `--task-id <taskId>` - Task ID
- `--project-id <projectId>` - Project ID
- `--region <region>` - Scheduling region (US-East, Singapore, US-EastRed, EU-Compliance2, EU-TTP2, US-TTP, …)
- `--sql <sql>` - Explicit SQL text
- `--sql-file <path>` - Read SQL from file
- `--region-recommend-mode <mode>` - Recommendation mode
- `--body-json <json>` - Full request JSON object

**Examples:**

```bash
# Let CLI infer taskId and SQL
bytedcli oceanus task dependency-recommendation get --node-id NdemoNode --project-id 123 --region US-East

# Use explicit SQL
bytedcli oceanus task dependency-recommendation get --node-id NdemoNode --task-id 456 --project-id 123 --region US-East --sql 'select * from sample_db.sample_table'
```

**Notes:**

- If `taskId` is missing, the CLI infers it from `node local-refine-status list`.
- SQL precedence is `--sql-file`, then `--sql`, then `bodyJson.sql`, then single-entry `bodyJson.queryList`, then automatic `node code get` resolution; empty SQL is rejected.
- If SQL is missing, the CLI reuses `node code get` logic to fetch effective code from the current draft.
- For coalesce drafts with `@{...}` placeholders, the CLI expands placeholders using the target region template values before requesting recommendations.

---

### task dependency-recommendation apply

Get dependency recommendations and write them back into the Oceanus global draft.

```bash
bytedcli oceanus task dependency-recommendation apply [options]
```

**Options:**

- `--node-id <nodeId>` - Node UID
- `--task-id <taskId>` - Task ID
- `--project-id <projectId>` - Project ID
- `--region <region>` - Scheduling region (US-East, Singapore, US-EastRed, EU-Compliance2, EU-TTP2, US-TTP, …)
- `--sql <sql>` - Explicit SQL text
- `--sql-file <path>` - Read SQL from file
- `--region-recommend-mode <mode>` - Recommendation mode
- `--replace-existing` - Replace existing explicit upstream dependencies
- `--body-json <json>` - Full request JSON object

**Examples:**

```bash
# Let CLI infer taskId and SQL, then write dependencies back
bytedcli oceanus task dependency-recommendation apply --node-id NdemoNode --project-id 123 --region US-East

# Replace existing explicit dependencies
bytedcli oceanus task dependency-recommendation apply --node-id NdemoNode --task-id 456 --project-id 123 --region US-East --sql 'select * from sample_db.sample_table' --replace-existing
```

**Notes:**

- SQL precedence is `--sql-file`, then `--sql`, then `bodyJson.sql`, then single-entry `bodyJson.queryList`, then automatic `node code get` resolution; empty SQL is rejected before applying recommendations.
- If `taskId` is missing, the CLI infers it from `node local-refine-status list`.
- If SQL is missing, the CLI reuses `node code get` logic to fetch effective code from the current draft.

## Notes

- Oceanus delete operations must be confirmed with the user before execution.
- Oceanus write operations such as create/update/delete, region create/add/delete, and global-local conversions should be reported back with operation records.
- Text mode uses structured presenter output for high-volume commands such as `project param list`, `task search`, `task bind-node get`, `node online-remote get`, `node region create` / `node region add` / `node region delete`, `node draft update`, and global-local conversions. Use `-j/--json` for scripts.
