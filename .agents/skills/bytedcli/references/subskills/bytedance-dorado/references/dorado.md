# Dorado (DataLeap) CLI Reference

Dorado is part of the DataLeap platform for data pipeline orchestration. This CLI provides commands to manage batch tasks, view instances, and update SQL queries.

Supported built-in regions: `cn`, `sg`, `va`, `mycis`, `gcp`/`eu`, `boe`, `boei18n`, `gp-us`.

Custom regions can be configured via `.dorado.env`:

```env
DORADO_REGION_PIPOUS_API_BASE_URL=https://dataleap-pipous.example.net/dorado_api
DORADO_REGION_PIPOUS_ALIASES=us_pipo,pipo-us,pipo_us,uspipo

# Optional: only set this for Dataleap environments that require browser-session cookies
# DORADO_REGION_PIPOUS_AUTH=session
```

If the target IDC/region is not covered by the built-in list, prefer adding a custom region in `.dorado.env` instead of modifying code. When `DORADO_REGION_<NAME>_SITE` is omitted, Dorado auth follows the global `--site` / `BYTEDCLI_CLOUD_SITE`.

`DORADO_REGION_<NAME>_AUTH` supports `jwt|auto|session`. Built-in regions default to `jwt`, except `mycis` and `gp-us`, which are built in as `session`; custom regions default to `auto`. Use `session` for known special Dataleap environments that require browser-session cookies in addition to JWT. Without `AUTH=session`, keep the normal JWT flow first and only switch to `bytedcli auth login --session` when the target region shows explicit web-auth signals, such as JSON output already including `error.hint` / `error.auth_command`, login redirects, or web-side auth failures.

When a user already provides an unknown custom region name, do not probe built-in regions as a fallback. Prefer configuring `.dorado.env` first and let the CLI return a direct configuration hint if the region is still unknown.

## Web URL formats

Dorado task and ad-hoc query pages can be mapped to CLI parameters:

- Task development page: `<host>/dorado/development/node/<taskId>?groupName=<region>&project=<region>_<projectId>`
- Ad-hoc query page: `<host>/dorado/development/query/<taskId>?groupName=<region>&project=<region>_<projectId>`

Use the path `<taskId>` as the task ID, `groupName` as `--region`, and the numeric suffix of `project` as `--project-id`.

## Commands

### spark-jar

Manage Spark-jar operator configuration on a Dorado node draft.

```bash
bytedcli dorado spark-jar create [options]
bytedcli dorado spark-jar update [options]
bytedcli dorado spark-jar get [options]
```

**Options:**
- `--node-id <nodeId>` - Node ID (required)
- `--main-class <mainClass>` - Spark main class (create: required; update: optional)
- `--main-file-path <path>` - Spark main file path (create: required; update: optional)
- `--main-resource-id <id>` - Main resource ID (create: required; update: optional)
- `--spark-version <ver>` - Spark version (create only, default: "3.2")
- `--params <params>` - Spark application params (create/update)
- `--spark-conf <k=v>` - Repeatable Spark conf entry as k=v (create/update)
- `--jars <json>` - JSON array string for jars (create/update)
- `--files <json>` - JSON array string for files (create/update)
- `--py-files <json>` - JSON array string for pyFiles (create/update)
- `--archives <json>` - JSON array string for archives (create/update)
- `--field <field>` - Field name to print (get only)
- `-r, --region <region>` - Dorado region (default: "cn")

`spark-jar update` requires at least one update field, e.g. `--main-class` or `--spark-conf`.

**Examples:**
```bash
# Create Spark-jar configuration on a node draft
bytedcli dorado spark-jar create --node-id demo-node-id \
  --main-class com.example.Main \
  --main-file-path /path/to/app.jar \
  --main-resource-id 100001234 \
  --spark-conf spark.executor.memory=2g \
  --spark-conf spark.sql.shuffle.partitions=200

# Read a single field (example output: com.example.Main)
bytedcli dorado spark-jar get --node-id demo-node-id --field mainClass

# Update sparkConf (repeat --spark-conf to set multiple keys)
bytedcli dorado spark-jar update --node-id demo-node-id \
  --spark-conf spark.sql.shuffle.partitions=200 \
  --spark-conf spark.executor.cores=4
```

---

### project list

List Dorado projects accessible to the user.

```bash
bytedcli dorado project list [options]
```

**Options:**
- `-r, --region <region>` - Dorado region (default: "cn")
- `-p, --page <page>` - Page number (default: 1)
- `--size <size>` - Page size (default: 50)

**Example:**
```bash
bytedcli dorado project list --region boei18n
```

---

### folder structure

Show the folder structure of a Dorado project.

```bash
bytedcli dorado folder structure [options]
```

**Options:**
- `--project-id <projectId>` - Project ID (required)
- `-r, --region <region>` - Dorado region (default: "cn")
- `--root-id <rootId>` - Root folder ID: -1 for task development (default), -2 for temp queries
- `--engine-id <engineId>` - Engine ID filter
- `--exclude-folder-id <excludeFolderId>` - Exclude folder ID

**Example:**
```bash
bytedcli dorado folder structure --project-id 458 --region cn
```

---

### folder children

List children of a Dorado folder.

```bash
bytedcli dorado folder children [options]
```

**Options:**
- `--folder-id <folderId>` - Folder ID (required)
- `--project-id <projectId>` - Project ID (required)
- `-r, --region <region>` - Dorado region (default: "cn")

**Example:**
```bash
bytedcli dorado folder children --folder-id 45678 --project-id 458 --region cn
```

---

### folder create

Create a subfolder in a Dorado project.

```bash
bytedcli dorado folder create [options]
```

**Options:**
- `--project-id <projectId>` - Project ID (required)
- `--parent-uri <parentUri>` - Parent directory URI, e.g. 'task:///HrdNGPWr' (defaults to root 'task:///' if omitted)
- `--name <name>` - Folder name (required)
- `--description <description>` - Folder description (optional)
- `-r, --region <region>` - Dorado region (default: "cn")

**Examples:**
```bash
# Create a subfolder under a specific parent directory
bytedcli dorado folder create --project-id 12345 --parent-uri "task:///HrdNGPWr" --name "demo-folder" --region cn

# Create with description
bytedcli dorado folder create --project-id 12345 --parent-uri "task:///HrdNGPWr" --name "demo-folder" --description "a demo subfolder" --region sg

# Create at root level
bytedcli dorado folder create --project-id 12345 --name "demo-folder" --region cn
```

**Output example:**
```
✓ Folder created successfully. Node UID: NB6LBxtiz, Name: demo-folder
```

---

### task list

List Dorado batch tasks.

```bash
bytedcli dorado task list [options]
```

**Options:**
- `-r, --region <region>` - Dorado region (default: "cn")
- `--project-id <projectId>` - Filter by project ID
- `--task-id <taskId>` - Filter by task ID
- `--task-name <taskName>` - Filter by task name
- `--owner <owner>` - Filter by owner
- `-p, --page <page>` - Page number (default: 1)
- `--size <size>` - Page size (default: 20)

**Example:**
```bash
bytedcli dorado task list --region boei18n --project-id 458 --owner yushuo.lin
```

---

### task search

Search Dorado tasks with status and folder filtering.

```bash
bytedcli dorado task search [options]
```

**Options:**
- `-r, --region <region>` - Dorado region (default: "cn")
- `--project-id <projectId>` - Filter by project ID (required)
- `--folder-id <folderId>` - Filter by folder ID (required by API)
- `--status <status>` - Filter by status (e.g. "init", "runnable", "closed"), comma-separated
- `--keyword <keyword>` - Filter by keyword in task name
- `-p, --page <page>` - Page number (default: 1)
- `--size <size>` - Page size (default: 20)

**Example:**
```bash
# Search for tasks in 'init' status in a specific folder
bytedcli dorado task search --region boei18n --project-id 458 --folder-id 123456 --status "init"

# Search with multiple statuses and keyword
bytedcli dorado task search --region boei18n --project-id 458 --folder-id 123456 --status "runnable,closed" --keyword "daily_report"
```

---

### task get

Get Dorado task details including dependency task IDs, source/target info for DTS tasks, and SQL code for hsql tasks.

```bash
bytedcli dorado task get [taskId] [options]
```

**Arguments:**
- `taskId` - Task ID (required)

**Options:**
- `-r, --region <region>` - Dorado region (default: "cn")

**Example:**
```bash
bytedcli dorado task get 100274211 --region boei18n
```

**Output for DTS tasks:**
- Source Type, Source DB, Source Table, Source Region
- Target Type, Target DB, Target Table, Target Region

**Output for tasks with dependencies:**
- Dependency Task IDs

**Output for hsql tasks:**
- SQL Code section with the query

---

### task update

Update SQL query for a task (hsql/fsql/stream_sql, saves as draft).

```bash
bytedcli dorado task update [taskId] [options]
```

**Arguments:**
- `taskId` - Task ID (required)

**Options:**
- `-q, --query <query>` - New SQL query (required)
- `-r, --region <region>` - Dorado region (default: "cn")

**Example:**
```bash
bytedcli dorado task update 100274211 --query "SELECT * FROM users WHERE active = 1" --region boei18n
```

**Note:** This command supports hsql, fsql, and stream_sql task types. It will reject unsupported task types.

---

### task-draft explain

Validate HSQL draft SQL syntax via Dorado `resource/explain`. This command also supports checking the latest online version or a specific published version.

```bash
bytedcli dorado task-draft explain [taskId] [options]
```

**Arguments:**
- `taskId` - Task ID (required)

**Options:**
- `-p, --project-id <projectId>` - Project ID (required)
- `--dc <dc>` - Data center, e.g. `mycisb` (optional; defaults to task dc)
- `--username <username>` - Username to validate as (optional; defaults to task owner)
- `--date <date>` - Biz date used for `${DATE}` / `${date}` / `${date-1}` substitution
- `--online` - Validate the latest published version instead of the draft
- `--version <version>` - Validate a specific published version
- `--template-var <key=value>` - Repeatable template replacement for `{{key}}`
- `--auto-strip-mustache` - Best-effort replace `{{foo}} -> foo`
- `--engine <engine>` - Engine name (default: `HIVE`)
- `--engine-type <engineType>` - Engine type (default: `spark`)
- `--prod-env` - Validate against production env
- `--no-inject-dorado-sets` - Do not append `set dorado.job.*`
- `-r, --region <region>` - Dorado region (default: "cn")

**Examples:**
```bash
# Validate the latest draft
bytedcli dorado task-draft explain 100274211 --project-id 458 --region boei18n

# Validate with biz date substitution
bytedcli dorado task-draft explain 100274211 --project-id 458 --date 2025-04-20 --region mycis

# Validate a template-based SQL draft
bytedcli dorado task-draft explain 100274211 --project-id 458 \
  --template-var hrbi_corehr_global=hrbi_corehr_global --region mycis

# Validate the latest online version
bytedcli dorado task-draft explain 100274211 --project-id 458 --online --region mycis

# Validate a specific published version
bytedcli dorado task-draft explain 100274211 --project-id 458 --version 6 --region mycis
```

**Note:** This command only supports `type=hsql` tasks.

---

### dts-draft explain

Validate DTS reader SQL syntax via Dorado `resource/explain`. The SQL source is `conf.configuration.reader.parameter.query`.

```bash
bytedcli dorado dts-draft explain [taskId] [options]
```

**Arguments:**
- `taskId` - Task ID (required)

**Options:**
- `-p, --project-id <projectId>` - Project ID (required)
- `--dc <dc>` - Data center, e.g. `mycisb` (optional; defaults to task dc)
- `--username <username>` - Username to validate as (optional; defaults to task owner)
- `--date <date>` - Biz date used for `${DATE}` / `${date}` / `${date-1}` substitution
- `--online` - Validate the latest published version instead of the draft
- `--version <version>` - Validate a specific published version
- `--template-var <key=value>` - Repeatable template replacement for `{{key}}`
- `--auto-strip-mustache` - Best-effort replace `{{foo}} -> foo`
- `--engine <engine>` - Engine name (default: `HIVE`)
- `--engine-type <engineType>` - Engine type (default: `spark`)
- `--prod-env` - Validate against production env
- `--inject-dorado-sets` - Append `set dorado.job.*` when `--date` is provided
- `-r, --region <region>` - Dorado region (default: "cn")

**Examples:**
```bash
# Validate DTS draft reader SQL
bytedcli dorado dts-draft explain 1204196358 --project-id 1200002135 --region mycis --date 2025-04-20

# Validate with template replacement
bytedcli dorado dts-draft explain 1204196358 --project-id 1200002135 \
  --template-var hrbi_atsx_global=hrbi_atsx_global --region mycis

# Validate the latest online version
bytedcli dorado dts-draft explain 1204196358 --project-id 1200002135 --online --region mycis
```

**Note:** This command supports DTS tasks where `conf.typeGroup` is `dts` or `common-dts-batch`.

---

### task binlog status

Check MySQL->Hive binlog task status.

```bash
bytedcli dorado task binlog status [options]
```

**Options:**
- `--task-id <taskId>` - Task ID used to infer source database/storage region and task type
- `--src-database <db>` - Source database (required if not inferred)
- `--src-storage-region <region>` - Source storage region (required if not inferred)
- `--subscribe-type <type>` - Subscribe type (default: "incremental")
- `--task-type <type>` - Task type (required if not inferred from --task-id)
- `--dorado-region-name <name>` - Dorado region name (required)
- `-r, --region <region>` - Dorado region (default: "cn")

**Examples:**
```bash
# Infer source info from task-id
bytedcli dorado task binlog status --task-id 67890 --dorado-region-name demo-region --region cn

# Explicit source info
bytedcli dorado task binlog status --src-database demo-db --src-storage-region demo-region --subscribe-type incremental --task-type mysql->hive --dorado-region-name demo-region --region cn
```

**Note:** When `--task-id` is provided, explicit `--src-database` / `--src-storage-region` / `--task-type` override inferred values.

---

### task binlog connect

Create and connect a MySQL->Hive binlog task.

```bash
bytedcli dorado task binlog connect [options]
```

**Options:**
- `--tree-node-id <id>` - Tree node ID (required)
- `--task-id <taskId>` - Task ID used to infer source info, owner, and task type
- `--owner <owner>` - Task owner (required if not inferred)
- `--src-database <db>` - Source database (required if not inferred)
- `--src-storage-region <region>` - Source storage region (required if not inferred)
- `--subscribe-type <type>` - Subscribe type (default: "incremental")
- `--task-type <type>` - Task type (required if not inferred from --task-id)
- `--dorado-region-name <name>` - Dorado region name (required)
- `--wait` - Wait until binlog is active
- `--wait-timeout-ms <ms>` - Wait timeout in ms (default: 60000)
- `--poll-interval-ms <ms>` - Poll interval in ms (default: 5000)
- `-r, --region <region>` - Dorado region (default: "cn")

**Examples:**
```bash
# Infer source info from task-id
bytedcli dorado task binlog connect --tree-node-id 123456 --task-id 67890 --dorado-region-name demo-region --region cn

# Explicit source info, wait for activation
bytedcli dorado task binlog connect --tree-node-id 123456 --src-database demo-db --src-storage-region demo-region --owner demo-owner --task-type mysql->hive --dorado-region-name demo-region --region cn --wait
```

**Note:** `--tree-node-id` must be provided. When `--wait` times out, retry the same command later.

---

### task diff

Compare SQL between two versions of a task.

```bash
bytedcli dorado task diff [taskId] [options]
```

**Arguments:**
- `taskId` - Task ID (required)

**Options:**
- `-r, --region <region>` - Dorado region (default: "cn")
- `--from <version>` - Source version number (default: latest published)
- `--to <version>` - Target version number, -1 for draft (default: -1 = draft)

**Examples:**
```bash
# Compare latest published version vs draft (default)
bytedcli dorado task diff 100274211 --region boei18n

# Compare two specific versions
bytedcli dorado task diff 100274211 --from 5 --to 6 --region boei18n

# Compare a specific version vs draft
bytedcli dorado task diff 100274211 --from 5 --region boei18n
```

**Output:** Unified diff of SQL code between the two versions. With `--json`, returns structured object including `from_sql`, `to_sql`, `has_diff`, and `diff` fields.

---

### task version list

List version history for a task.

```bash
bytedcli dorado task version list [taskId] [options]
```

**Arguments:**
- `taskId` - Task ID (required)

**Options:**
- `-r, --region <region>` - Dorado region (default: "cn")
- `-p, --page <page>` - Page number (default: 1)
- `--size <size>` - Page size (default: 20)
- `--include-draft` - Include latest draft in results (default: false)

**Example:**
```bash
bytedcli dorado task version list 100052730 --region boei18n
```

---

### task online

Deploy (bring online) a task by committing its current draft.

```bash
bytedcli dorado task online [taskId] [options]
```

**Arguments:**
- `taskId` - Task ID (required)

**Options:**
- `--project-id <projectId>` - Project ID (required)
- `--message <message>` - Deploy message
- `--skip-codes <codes>` - Skip specific error codes during commit
- `-r, --region <region>` - Dorado region (default: "cn")

**Example:**
```bash
bytedcli dorado task online 100052730 --project-id 458 --region boei18n
bytedcli dorado task online 100052730 --project-id 458 --message "deploy v2" --skip-codes "-1005" --region va
```

---

### task commit-approval

Submit a task draft for approval using the web IDE commit-and-deploy payload shape.

```bash
bytedcli dorado task commit-approval [taskId] [options]
```

**Arguments:**
- `taskId` - Task ID (required)

**Options:**
- `--project-id <projectId>` - Project ID (required)
- `--review-policy-id <id>` - Review policy ID (required; must be explicitly provided by the caller for the current project)
- `--review-users <users>` - Comma-separated reviewer usernames (required; must be explicitly provided by the caller for the current project)
- `--custom-alarm-rule-ids <ids>` - Comma-separated alarm rule IDs
- `--agent-config <json>` - Agent config JSON string
- `--skip-codes <codes>` - Skip specific error codes during commit
- `--no-open-default-system-alarm` - Disable default system alarm
- `-r, --region <region>` - Dorado region (default: "cn")

**Note:** `review-policy-id` and `review-users` vary by project. Do not infer them from project defaults; ask the user to provide both values explicitly.
Use this dedicated command because the approval payload is page-shaped and sensitive to field presence/semantics; do not emulate it with nearby non-approval commands plus extra fields.

**Example:**
```bash
bytedcli dorado task commit-approval 100052730 --project-id 458 \
  --review-policy-id 24 \
  --review-users "demo-user-a,demo-user-b" \
  --custom-alarm-rule-ids 11870,14696 \
  --agent-config '{"sessionId":"demo-session"}' \
  --region mycis
```

---

### task commit-batch-approval

Submit multiple Dorado commits for approval in one deploy package through the web `deploy/v2/create` payload shape.

```bash
bytedcli dorado task commit-batch-approval [options]
```

**Options:**
- `--project-id <projectId>` - Project ID (required)
- `--name <name>` - Deploy package name (required)
- `--message <message>` - Approval message shown in the deploy package
- `--review-policy-id <id>` - Review policy ID (required; must be explicitly provided by the caller for the current project)
- `--review-users <users>` - Comma-separated reviewer usernames (required; must be explicitly provided by the caller for the current project)
- `--commit-ids <ids>` - Comma-separated commit IDs to include in the batch (required)
- `--skip-codes <codes>` - Skip specific error codes during approval submission
- `--develop-conf <json>` - Optional `deployPackage.developConf` JSON object
- `-r, --region <region>` - Dorado region (default: "cn")

**Note:** Keep this separate from `task commit-approval` because batch approval uses `reviewPackages[]` plus a `deployPackage` envelope. Do not emulate it by looping single-task approval commands.

**Example:**
```bash
bytedcli dorado task commit-batch-approval --project-id 458 \
  --name demo_pkg_20260507 \
  --message "batch approval" \
  --review-policy-id 24 \
  --review-users "demo-user-a,demo-user-b" \
  --commit-ids "108103,108111,108110" \
  --region mycis
```

---

### instance list

List Dorado task instances.

```bash
bytedcli dorado instance list [options]
```

**Options:**
- `-r, --region <region>` - Dorado region (default: "cn")
- `--project-id <projectId>` - Filter by project ID (required for listing)
- `--task-id <taskId>` - Filter by task ID
- `--status <status>` - Filter by status (running, success, failed, etc.)
- `--start-time <time>` - Filter by start time (ISO format)
- `--end-time <time>` - Filter by end time (ISO format)
- `-p, --page <page>` - Page number (default: 1)
- `--size <size>` - Page size (default: 20)

**Example:**
```bash
bytedcli dorado instance list --region boei18n --project-id 458 --task-id 100052730
```

---

### instance get

Get Dorado instance details.

```bash
bytedcli dorado instance get [instanceId] [options]
```

**Arguments:**
- `instanceId` - Instance ID (required)

**Options:**
- `-r, --region <region>` - Dorado region (default: "cn")

**Example:**
```bash
bytedcli dorado instance get 258345284 --region boei18n
```

---

### instance slowest-link

Get the slowest task link in each layer of the upstream execution chain of a specified task instance.

```bash
bytedcli dorado instance slowest-link [instanceId] [options]
```

**Arguments:**
- `instanceId` - Instance ID (required)

**Options:**
- `--project-id <projectId>` - Project ID (required)
- `--root-instance-id <rootInstanceId>` - Root instance ID (optional, defaults to instanceId)
- `--root-project-id <rootProjectId>` - Root project ID (optional, defaults to projectId)
- `-r, --region <region>` - Dorado region (default: "cn")

**Example:**
```bash
bytedcli dorado instance slowest-link 258345284 --project-id 458 --region cn
bytedcli dorado instance slowest-link 258345284 --project-id 458 --region sg --root-instance-id 258345284 --root-project-id 458
```

---

### instance log-summary

Get the log summary for a Dorado instance.

```bash
bytedcli dorado instance log-summary [instanceId] [options]
```

**Arguments:**
- `instanceId` - Instance ID (required)

**Options:**
- `--project-id <projectId>` - Project ID (required)
- `--fetch-rule <fetchRule>` - Fetch rule (default: 2)
- `-r, --region <region>` - Dorado region (default: "cn")

**Example:**
```bash
bytedcli dorado instance log-summary 258345284 --project-id 458 --region cn
```

---

### instance diagnose

Get diagnose data for a Dorado offline task instance (e.g. Spark).

```bash
bytedcli dorado instance diagnose [instanceId] [options]
```

**Arguments:**
- `instanceId` - Instance ID (required)

**Options:**
- `--project-id <projectId>` - Project ID (required)
- `--engine <engine>` - Compute engine segment in URL path (default: "spark")
- `--run-mode <runMode>` - Diagnose run mode (default: "system")
- `--no-trigger` - Do not trigger a new diagnose, only read cached result
- `-r, --region <region>` - Dorado region (default: "cn")

**Example:**
```bash
bytedcli dorado instance diagnose 6330831719 --project-id 1118 --region cn
```

---

### Debug permission failures and apply via Coral

Use this flow when a Dorado instance fails quickly with a TQS/Hive permission error. If the user gives a numeric ID and calls it an "instance", verify whether it is actually a task ID: `instance get` will fail or not find recent records, while `task get <id> --region <region>` returns task metadata.

Do not use `bytedcli hive` or `bytedcli iam` to apply missing Hive/TQS permissions for a Dorado task. `hive` is useful for metadata lookup and `iam` for employee identity lookup; permission application should go through `bytedcli coral permission apply`.

1. Confirm task and project metadata:

```bash
bytedcli --json dorado task get <task_id> --region va
bytedcli --json dorado project get <project_id> --region va
```

2. For a task ID, list recent records by schedule date to find failed instance IDs:

```bash
bytedcli --json dorado instance record <task_id> \
  --project-id <project_id> --region va --schedule <yyyy-MM-dd+HH:mm:00>
```

For broad recent searches, always bound the time window and page through results. Unbounded project instance lists can time out.

```bash
bytedcli --json dorado instance list --project-id <project_id> --region va \
  --start-time <start_iso_time> --end-time <end_iso_time> \
  --page-size 100 --page 1
```

3. Inspect the failed instance and fetch the log to `/tmp`:

```bash
bytedcli --json dorado instance get <instance_id> --region va
bytedcli --json dorado instance diagnose <instance_id> --project-id <project_id> --region va
bytedcli dorado download-instance-log --instance-id <instance_id> \
  --project-id <project_id> --region va --output /tmp/dorado_<instance_id>.log --json
```

4. Parse `NoPrivilegeException` lines from the log. Required privileges are emitted in this shape:

```text
User <user_or_psm> does not have privileges for QUERY
Server=hive->Db=<db>->Table=<table>->Columns=[<column>]->action=select
Server=hive->Db=<db>->Table=<table>->Rows=[<row_policy>]->action=select
```

Apply read permission through Coral for every affected auth subject. For Dorado tasks that run with a project PSM/account, apply for both the human owner and the project PSM if both appear in the error. Repeat `--column` for the missing columns; omit `--column` only for table-level access.

```bash
bytedcli --json coral permission apply --region va \
  --db-name example_db --table-name example_table \
  --auth-type person --auth-object demo-user --permission read \
  --column sample_col --column sample_col_2 \
  --requirement-type index-calculation \
  --reason "Dorado task <task_id> needs these columns for scheduled aggregation."

bytedcli --json coral permission apply --region va \
  --db-name example_db --table-name example_table \
  --auth-type psm --auth-object demo.project.psm --permission read \
  --column sample_col --column sample_col_2 \
  --requirement-type index-calculation \
  --reason "Dorado task <task_id> runs with this project PSM and needs these columns."
```

If Coral returns `CORAL_PERMISSION_RESOURCE_CLOSED`, the table is not open for Coral permission applications. Report that no application was created and include the returned table URL/resource details; do not claim success or invent an approval link.

---

### task relation-nodes

Get task upstream/downstream lineage nodes at specified time.

```bash
bytedcli dorado task relation-nodes [options]
```

**Options:**
- `--project-id <projectId>` - Project ID (required)
- `--task-id <taskId>` - Task ID (required)
- `--task-time <taskTime>` - Task time (yyyy-MM-dd+HH:mm:00) (required)
- `--relation <relation>` - Relation type: parent (upstream) or children (downstream) (default: "parent")
- `--depth <depth>` - Lineage depth (default: 1)
- `--no-combine` - Do not combine nodes (default: combine)
- `--task-type <taskType>` - Task type (e.g., hsql) (optional)
- `--cross-region` - Whether to enable cross-region query (optional)
- `-r, --region <region>` - Dorado region (default: "cn")

**Examples:**
```bash
# Query upstream lineage (default) without task-type
bytedcli dorado task relation-nodes --project-id 10 --task-id 123651434 --task-time "2026-04-13+02:00:00" --region cn

# Query upstream lineage (default) with task-type
bytedcli dorado task relation-nodes --project-id 10 --task-id 123651434 --task-time "2026-04-13+02:00:00" --task-type hsql --region cn

# Query downstream lineage
bytedcli dorado task relation-nodes --project-id 10 --task-id 123651434 --task-time "2026-04-13+02:00:00" --task-type hsql --relation children --region cn

# Query lineage with depth 2
bytedcli dorado task relation-nodes --project-id 10 --task-id 123651434 --task-time "2026-04-13+02:00:00" --task-type hsql --depth 2 --region sg

# JSON mode
bytedcli dorado task relation-nodes --project-id 10 --task-id 123651434 --task-time "2026-04-13+02:00:00" --task-type hsql -j
```

---

### node create

Create a new python/notebook/spark task node in a project.

```bash
bytedcli dorado node create --project-id <projectId> --name <name> --type <type> -r <region>
```

**Options:**
- `-p, --project-id <projectId>` - Project ID (required)
- `--name <name>` - Node name (required)
- `--type <type>` - Task type: `python`, `notebook`, or `spark` (default: "python")
- `--parent-uri <uri>` - Parent directory URI (default: "task:///"); use URIs from `tree-nodes children`
- `--description <description>` - Node description
- `--content <content>` - Initial code content (inline string)
- `--content-file <path>` - Path to file containing initial code
- `--metadata <json>` - Task configuration metadata as JSON string
- `--image-name <name>` - Docker image name
- `--image-id <id>` - Docker image ID (use `image list` to find)
- `--language <lang>` - Spark language: python, java, scala (spark only, default: "python")
- `--spark-version <ver>` - Spark version (spark only, default: "3.2")
- `--data-outputs <spec>` - Task data outputs config. Accepts JSON array (e.g. `'[{"type":"partition","databaseName":"dp_compliance","tableName":"demo_table","partitions":[{"key":"date","value":"${date}"}],"namespace":"sg"}]'`) or shorthand notation: `"other"`, `"db.table:date=${date},ns=sg"`, `"hdfs:/path"`, multiple entries separated by `";"`. Default: `[{"type":"other"}]`
- `-r, --region <region>` - Dorado region (default: "cn")

**Examples:**
```bash
# Create a python task
bytedcli dorado node create --project-id 458 --name demo-python-task --type python --region cn

# Create a notebook
bytedcli dorado node create --project-id 458 --name demo-notebook --type notebook --region cn

# Create a spark (PySpark) task
bytedcli dorado node create --project-id 458 --name demo-spark-task --type spark --region cn

# Create with Docker image (use image list to find id + name first)
bytedcli dorado node create --project-id 458 --name demo-python-task --type python --image-name demo-image --image-id 400012345 --region cn
bytedcli dorado node create --project-id 458 --name demo-notebook --type notebook --image-name demo-image --image-id 400012345 --region cn
bytedcli dorado node create --project-id 458 --name demo-spark-task --type spark --image-name demo-image --image-id 400012345 --region cn

# Spark task with explicit language and version (defaults: python, 3.2)
bytedcli dorado node create --project-id 458 --name demo-pyspark --type spark --language python --spark-version 3.2 --image-name demo-image --image-id 400012345 --region cn

# Create in a subfolder with initial code from file
bytedcli dorado node create --project-id 458 --name demo-notebook --type notebook --parent-uri "task:///f123/NdemoDir" --content-file ./my_notebook.ipynb --region cn

# Create with data outputs: partitioned Hive table
bytedcli dorado node create --project-id 458 --name demo-task --type python --data-outputs 'dp_compliance.demo_table:date=${date},ns=sg' --region sg

# Create with data outputs: HDFS path
bytedcli dorado node create --project-id 458 --name demo-task --type python --data-outputs 'hdfs:/sg/data/demo/output' --region sg

# Create with mixed data outputs (JSON array)
bytedcli dorado node create --project-id 458 --name demo-task --type spark --data-outputs '[{"type":"partition","databaseName":"dp_compliance","tableName":"demo_table","partitions":[{"key":"date","value":"${date}"}],"namespace":"sg"},{"type":"other"}]' --region sg
```

**Note:** When `--image-name`/`--image-id` is provided, `node create` automatically performs a follow-up save to ensure the image configuration persists correctly (the platform's create API does not fully persist nested `conf` on creation).

---

### node get

Get node draft content (code and metadata) for a python/notebook/spark task.

```bash
bytedcli dorado node get --node-id <nodeId> -r <region>
```

**Options:**
- `--node-id <nodeId>` - Node ID, e.g. `NxyzABC` (required)
- `-r, --region <region>` - Dorado region (default: "cn")

**Example:**
```bash
bytedcli dorado node get --node-id NxyzABC --region boei18n -j
```

---

### node save

Save (update) a python/notebook/spark node draft. Must include `--metadata` — API requires it. Standard practice: first `node get -j` to get current metadata, modify as needed, then write back the full metadata.

```bash
bytedcli dorado node save --node-id <nodeId> --metadata '<json>' -r <region>
```

**Options:**
- `--node-id <nodeId>` - Node ID (required)
- `--content <content>` - Code content (inline string)
- `--content-file <path>` - Path to file containing code content
- `--metadata <json>` - Full task configuration metadata as JSON string (required for most updates)
- `--image-name <name>` - Docker image name
- `--image-id <id>` - Docker image ID
- `--language <lang>` - Spark language (spark only)
- `--spark-version <ver>` - Spark version (spark only)
- `--data-outputs <spec>` - Task data outputs config. Accepts JSON array or shorthand notation (see `node create` for format). When provided without `--metadata`, automatically fetches and merges with the existing draft metadata
- `-r, --region <region>` - Dorado region (default: "cn")

**Example:**
```bash
# Save code from file with existing metadata
bytedcli dorado node save --node-id NxyzABC --content-file ./script.py --metadata '{"name":"demo","type":"python","configuration":{...}}' --region boei18n

# Update data outputs to a partitioned Hive table (shorthand)
bytedcli dorado node save --node-id NxyzABC --data-outputs 'dp_compliance.demo_table:date=${date},ns=sg' --region sg

# Update data outputs with multiple entries separated by ;
bytedcli dorado node save --node-id NxyzABC --data-outputs 'dp_compliance.demo_table:date=${date},ns=sg;other' --region sg
```

---

### node submit

Submit (commit and deploy) a python/notebook/spark node without approval fields. Defaults to auto-release.

```bash
bytedcli dorado node submit --node-id <nodeId> --project-id <projectId> -r <region>
```

**Options:**
- `--node-id <nodeId>` - Node ID (required)
- `-p, --project-id <projectId>` - Project ID (required)
- `--message <message>` - Commit message
- `--no-auto-release` - Do not auto-release after commit
- `--no-skip-commit-pipeline` - Do not skip commit pipeline checks
- `-r, --region <region>` - Dorado region (default: "cn")

**Example:**
```bash
bytedcli dorado node submit --node-id NxyzABC --project-id 458 --message "deploy via bytedcli" --region boei18n
```

---

### node submit-approval

Submit (commit and deploy) a python/notebook/spark node with approval fields. Defaults to auto-release.

```bash
bytedcli dorado node submit-approval --node-id <nodeId> --project-id <projectId> -r <region>
```

**Options:**
- `--node-id <nodeId>` - Node ID (required)
- `-p, --project-id <projectId>` - Project ID (required)
- `--message <message>` - Commit message
- `--no-auto-release` - Do not auto-release after commit
- `--no-skip-commit-pipeline` - Do not skip commit pipeline checks
- `--review-policy-id <id>` - Review policy ID (required; must be explicitly provided by the caller for the current project)
- `--review-users <users>` - Comma-separated reviewer usernames (required; must be explicitly provided by the caller for the current project)
- `--custom-alarm-rule-ids <ids>` - Comma-separated alarm rule IDs
- `--agent-config <json>` - Agent config JSON string
- `-r, --region <region>` - Dorado region (default: "cn")

**Note:** `review-policy-id` and `review-users` vary by project. Do not infer them from project defaults; ask the user to provide both values explicitly.
Use this dedicated command because the approval payload is page-shaped and sensitive to field presence/semantics; do not emulate it with plain `node submit` plus extra approval fields.

**Example:**
```bash
bytedcli dorado node submit-approval --node-id NxyzABC --project-id 458 --message "deploy via bytedcli" \
  --review-policy-id 33 --review-users "demo.user1,demo.user2" --region boei18n
```

---

### node relation

Query nodeId → taskId mapping. Use the returned taskId with task-related APIs (`task get`, `instance list`, etc.).

```bash
bytedcli dorado node relation --node-id <nodeIds> -r <region>
```

**Options:**
- `--node-id <nodeIds>` - Node ID(s), comma-separated for batch query (required)
- `-r, --region <region>` - Dorado region (default: "cn")

**Example:**
```bash
# Single query
bytedcli dorado node relation --node-id NxyzABC --region boei18n

# Batch query
bytedcli dorado node relation --node-id NxyzABC,NxyzDEF --region boei18n -j
```

---

### node history

List node commit history (production versions). Returns version number, commitId, creator, update time, and commit message.

```bash
bytedcli dorado node history --node-id <nodeId> -r <region>
```

**Options:**
- `--node-id <nodeId>` - Node ID (required)
- `--page <page>` - Page number (default: 1)
- `--size <size>` - Page size (default: 30)
- `-r, --region <region>` - Dorado region (default: "cn")

**Example:**
```bash
bytedcli dorado node history --node-id NxyzABC --region cn
bytedcli dorado node history --node-id NxyzABC --page 1 --size 10 --region cn
```

---

### node rollback

Rollback node draft to a historical production version. Only affects draft, not online production.

```bash
bytedcli dorado node rollback --node-id <nodeId> --commit-id <commitId> -r <region>
bytedcli dorado node rollback --node-id <nodeId> --latest -r <region>
```

**Options:**
- `--node-id <nodeId>` - Node ID (required)
- `--commit-id <commitId>` - Commit ID to rollback to (mutually exclusive with `--latest`)
- `--latest` - Rollback to the latest production version (mutually exclusive with `--commit-id`)
- `-r, --region <region>` - Dorado region (default: "cn")

**Examples:**
```bash
# Rollback to a specific version
bytedcli dorado node rollback --node-id NxyzABC --commit-id C61P1ztyn0R6dknxP --region cn

# Quick rollback to latest production version
bytedcli dorado node rollback --node-id NxyzABC --latest --region cn
```

**Note:** `--commit-id` and `--latest` are mutually exclusive. After rollback, submit again with `node submit` to deploy to production.

---

### image list

List available Docker images for a project. Use the returned `id` + `name` when configuring the node image via `node create/save --image-name/--image-id`.

```bash
bytedcli dorado image list --project-id <projectId> -r <region>
```

**Options:**
- `-p, --project-id <projectId>` - Project ID (required)
- `-r, --region <region>` - Dorado region (default: "cn")
- `-k, --keyword <keyword>` - Filter by image name keyword

**Example:**
```bash
bytedcli dorado image list --project-id 458 --region cn -k demo_image -j
```

---

### node resolve-uid

When a DataLeap URL or workflow only provides a numeric **taskId** but you need the IDE **nodeUid** (`N...` for `dorado node get` / `node save`), call this first. It fetches the task name/type via `get-task`, then walks the project tree via `tree-nodes children` with a `name+type` filter — the backend returns only the single direct child on the path to a match, so the command drills down a single path to the matching leaf node, then verifies with `node-relations`.

```bash
bytedcli dorado node resolve-uid --project-id <projectId> --task-id <taskId> -r <region>
```

**Options:**
- `-p, --project-id <projectId>` - Project ID (required)
- `--task-id <taskId>` - Numeric task ID (required)
- `-r, --region <region>` - Dorado region (default: "cn")
- `--skip-relation-verify` - Skip node-relations verification (not recommended)

**Example:**
```bash
bytedcli dorado node resolve-uid --project-id 458 --task-id 100274211 --region boei18n -j
```

If this returns no `nodeUid`, verify `--region`, `--project-id`, `--task-id`, and auth.

---

### adhoc exec

Execute an ad-hoc SQL query via the Dorado ad-hoc query API. Requires a pre-existing **ad-hoc query task** (临时查询) as the execution carrier — create one in Dorado (Project > Ad-hoc Query > New Query, 即"临时查询"), and it is recommended to switch the engine to Spark on the query page before saving. Then configure dc/cluster/queue, save the task, and pass its ID via `--task-id`. The task only needs to be created once; dc/cluster/queue are inherited from the saved configuration. bytedcli also auto-loads `DORADO_EXEC_TASK_ID` from `~/.local/share/bytedcli/data/.dorado.env` and the current directory's `./.dorado.env`, with the local project file taking precedence over the global file.

**Safety check:** Before executing, the command verifies that the carrier task is **not** an online production task. If the task is online, execution is blocked to prevent unintended modifications to production task state. Use `--force` to bypass this check (not recommended).

With `--wait`, polls until completion and fetches the result (first 10 rows previewed in text mode; full data in JSON mode). With `-o`, downloads the full result as CSV.

```bash
bytedcli dorado adhoc exec [sql] [options]
```

**Arguments:**
- `sql` - SQL query (or provide via stdin)

**Options:**
- `--task-id <taskId>` - Ad-hoc query task ID (临时查询任务 ID), created in Dorado (Project > Ad-hoc Query > New Query). Only needs to be created once. Can also set via `DORADO_EXEC_TASK_ID`
- `--project-id <projectId>` - Project ID (auto-detected if omitted)
- `-r, --region <region>` - Dorado region (default: "cn")
- `--dc <dc>` - Data center
- `--cluster <cluster>` - Cluster
- `--queue <queue>` - Queue
- `--engine-type <type>` - Engine type (default: "auto")
- `--username <username>` - Owner username (defaults to task owner)
- `--date <date>` - Schedule date in YYYYMMDD format (defaults to yesterday)
- `-o, --output <path>` - Download result CSV to file
- `--no-wait` - Submit only, do not wait for completion
- `--timeout <seconds>` - Poll timeout in seconds (default: 600)
- `--force` - Bypass online-task safety check (use with caution)

**Examples:**
```bash
# Execute and display results (default: waits for completion)
bytedcli dorado adhoc exec "SELECT count(*) FROM db.table" --task-id 100274211 --region boei18n

# SQL from stdin
echo "SELECT * FROM db.table LIMIT 10" | bytedcli dorado adhoc exec --task-id 100274211 --region boei18n

# Download full result as CSV
bytedcli dorado adhoc exec "SELECT * FROM db.table LIMIT 10" --task-id 100274211 -o result.csv

# Async: submit only, get debugId for later status/result queries
bytedcli dorado adhoc exec "复杂SQL" --task-id 100274211 --no-wait

# Using .dorado.env defaults (auto-loaded from ~/.local/share/bytedcli/data/.dorado.env or ./.dorado.env)
# DORADO_EXEC_TASK_ID=100274211
bytedcli dorado adhoc exec "SELECT 1" --region boei18n

# JSON output (includes full result data)
bytedcli dorado adhoc exec "SELECT * FROM db.table" --task-id 100274211 --json
```

---

### adhoc status

Get ad-hoc execution status by debug ID. Use to check whether an async `adhoc exec` has completed.

```bash
bytedcli dorado adhoc status [options]
```

**Options:**
- `--debug-id <debugId>` - Debug ID (from `adhoc exec` output)
- `--task-id <taskId>` - Task ID (or `DORADO_EXEC_TASK_ID`)
- `--project-id <projectId>` - Project ID (auto-detected if omitted)
- `-r, --region <region>` - Dorado region (default: "cn")

**Status values:** `pending`, `running`, `succeed`, `failed`, `aborted`

**Example:**
```bash
bytedcli dorado adhoc status --debug-id 12977673 --task-id 119886373
```

---

### adhoc result

Get ad-hoc execution result by debug ID. Displays as a table (text mode) or returns full data (JSON mode). Use `-o` to download as CSV.

```bash
bytedcli dorado adhoc result [options]
```

**Options:**
- `--debug-id <debugId>` - Debug ID (from `adhoc exec` output)
- `--task-id <taskId>` - Task ID (or `DORADO_EXEC_TASK_ID`)
- `--project-id <projectId>` - Project ID (auto-detected if omitted)
- `-r, --region <region>` - Dorado region (default: "cn")
- `-o, --output <path>` - Download result as CSV to file

**Examples:**
```bash
# Display result (first 10 rows in text mode)
bytedcli dorado adhoc result --debug-id 12977673 --task-id 119886373 --region cn

# Download as CSV
bytedcli dorado adhoc result --debug-id 12977673 --task-id 119886373 -o result.csv

# Full data in JSON
bytedcli dorado adhoc result --debug-id 12977673 --task-id 119886373 --json
```

---

### adhoc history

List ad-hoc execution history for a task.

```bash
bytedcli dorado adhoc history [options]
```

**Options:**
- `--task-id <taskId>` - Task ID (or `DORADO_EXEC_TASK_ID`)
- `--project-id <projectId>` - Project ID (auto-detected if omitted)
- `-r, --region <region>` - Dorado region (default: "cn")
- `--page <page>` - Page number (default: 1)
- `--page-size <size>` - Page size (default: 20)
- `--only-mine` - Show only my executions

**Examples:**
```bash
# List ad-hoc history for a task
bytedcli dorado adhoc history --task-id 119886373

# Show only my executions
bytedcli dorado adhoc history --task-id 119886373 --only-mine

# JSON output
bytedcli dorado adhoc history --task-id 119886373 --json
```

---

## Task Types

| Type | Description | Managed via |
|------|-------------|-------------|
| `hsql` | Hive SQL task - runs SQL queries | `task` / `task-draft` commands |
| `fsql` | Flink SQL task - runs streaming SQL queries | `task` / `task-draft` commands |
| `stream_sql` | Stream SQL task - continuous streaming SQL processing | `task` / `task-draft` commands |
| `python` | Python script task - runs Python code with Docker image | `node` commands |
| `notebook` | Jupyter Notebook task - interactive notebook execution | `node` commands |
| `spark` | Spark task (PySpark/Java/Scala) - runs Spark jobs with Docker image | `node` commands |
| `mysql->hive` | DTS task - syncs data from MySQL to Hive | `task` commands |
| `hive->bmq` | DTS task - syncs data from Hive to BMQ | `task` commands |
| `common-dts-batch` | Generic DTS batch task | `task` commands |

## Instance Status

| Status | Description |
|--------|-------------|
| `pending` | Waiting to run |
| `running` | Currently executing |
| `success` | Completed successfully |
| `failed` | Failed execution |

## Authentication

The CLI uses JWT authentication via SSO. Ensure you are logged in:

```bash
bytedcli auth login
```
