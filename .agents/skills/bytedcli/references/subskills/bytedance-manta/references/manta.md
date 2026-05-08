# Manta (DataLeap) CLI Reference

Manta is part of the DataLeap platform for data profiling and quality management. This CLI provides commands to query namespaces, list table monitor rules, create profiling rules, list profiling jobs, get profiling results, query comparison job summaries, and authenticate with DataLeap Manta.

Supported regions: `cn`, `sg`, `va`, `eu`, `mycis`.

## Commands

### auth login

Login to DataLeap Manta via browser. Requires `puppeteer-core` installed globally.

```bash
bytedcli manta auth login [options]
```

**Options:**
- `--region <region>` - Region (default: "cn")

**Examples:**
```bash
bytedcli manta auth login
bytedcli manta auth login --region cn
bytedcli manta auth login --region va
```

---

### yarn-queues

List available YARN queues for the current user in a given region. Use this to discover valid `--yarn-cluster` and `--yarn-queue` values before creating profiling rules.

```bash
bytedcli manta yarn-queues [options]
```

**Options:**
- `--region <region>` - Region (default: "cn")
- `-u, --username <username>` - Username (defaults to server-side identity)

**Examples:**
```bash
bytedcli manta yarn-queues --region va
bytedcli manta yarn-queues --region sg --username demo-user
bytedcli --json manta yarn-queues --region va
```

**Output:** Each queue is displayed as `region/idc/yarn_cluster/yarn_queue (load: X%)`. Use the `yarn_cluster` and `yarn_queue` fields as `--yarn-cluster` and `--yarn-queue` when creating profiling rules.

---

### namespaces

List available Manta namespaces for the selected region.

```bash
bytedcli manta namespaces [options]
```

**Options:**
- `--region <region>` - Region (default: "cn")
- `--cookie <cookie>` - DataLeap cookie string (or set `BYTEDCLI_MANTA_COOKIE` env var)

**Examples:**
```bash
bytedcli manta namespaces --region sg
bytedcli --json manta namespaces --region va
```

---

### monitor list

List table monitor rules. This is a read-only query over monitor objects; text output expands nested `parts[].monitors[]` rows into one row per rule.

```bash
bytedcli manta monitor list [options]
```

**Options:**
- `--region <region>` - Region (default: "cn")
- `--table-name-query <query>` - Search by database/table name
- `--project-id <id>` - Filter by project ID, repeatable
- `--mine` - Only list my monitor objects
- `--triggered-only` - Only list triggered monitor objects
- `--monitor-state <state>` - Filter by monitor state
- `--monitor-type <type>` - Filter by monitor type, repeatable
- `--limit <n>` - Maximum rows to return (default: 100)
- `--offset <n>` - Pagination offset (default: 0)
- `--cookie <cookie>` - DataLeap cookie string (or set `BYTEDCLI_MANTA_COOKIE` env var)

**Examples:**
```bash
bytedcli manta monitor list --region mycis --table-name-query demo_db.demo_table --project-id 1234567
bytedcli manta monitor list --region sg --monitor-type Table_Lines --monitor-state RUNNABLE
bytedcli --json manta monitor list --region va --table-name-query demo_db.demo_table
```

**Notes:**
- `monitor list` 用于查监控规则与最近一次监控执行状态，`profile job list` 用于查数据探查任务历史；两者是并列查询入口，不要混用。
- `monitor list` 的后端接口是 `POST /monitor/object/find_monitors`，请求体按 `filter + search + pagination + project_ids` 组织。
- 文本模式会把 `parts[].monitors[]` 扁平化成逐条规则的表格行；`--json` 会保留原始嵌套结构，便于上层自动化处理。
- 查询具体表的监控规则时，如果已知项目归属，优先显式传 `--project-id`。在 `mycis` 等区域，仅使用 `--table-name-query` 或无筛选条件时，`find_monitors` 可能返回 `50005`。
- 推荐排查顺序：先执行 `manta monitor list --project-id ... --table-name-query ...`，再执行 `manta profile job list`，并明确区分“接口异常”和“确认无数据”。

---

### profile job list

List existing data profiling jobs. This is a read-only query and can filter by owner plus one search option: instance ID, table name, or description.

```bash
bytedcli manta profile job list [options]
```

**Options:**
- `--region <region>` - Region (default: "cn")
- `--instance-id <id>` - Search by profiling job instance ID
- `--table-name-query <query>` - Search by database/table name
- `--description-query <query>` - Search by description
- `--mine` - Only list my data profiling jobs
- `--limit <n>` - Maximum rows to return (default: 100)
- `--offset <n>` - Pagination offset (default: 0)
- `--cookie <cookie>` - DataLeap cookie string (or set `BYTEDCLI_MANTA_COOKIE` env var)

**Examples:**
```bash
bytedcli manta profile job list --region sg --table-name-query demo_table --limit 20
bytedcli manta profile job list --region va --instance-id 123456
bytedcli --json manta profile job list --region mycis --mine
```

---

### profile job result

Get a data profiling job result. The result includes overview, quality, detail, and partition_detail sections returned by Manta.

```bash
bytedcli manta profile job result [options]
```

**Options:**
- `--region <region>` - Region (default: "cn")
- `--instance-id <id>` - Profiling job instance ID (required)
- `--cookie <cookie>` - DataLeap cookie string (or set `BYTEDCLI_MANTA_COOKIE` env var)

**Examples:**
```bash
bytedcli manta profile job result --region sg --instance-id 123456
bytedcli --json manta profile job result --region va --instance-id 123456
```

---

### profile rule create

Create a data profiling rule on the DataLeap Manta platform.

```bash
bytedcli manta profile rule create [options]
```

**Options:**
- `--region <region>` - Region (default: "cn")
- `--db-name <name>` - Database name (required unless `--body-file`)
- `--tb-name <name>` - Table name (required unless `--body-file`)
- `--partitions <partition>` - Partitions, repeatable (e.g. `date=20260331`); multi-level: `date=20260331/asset_type=sdk/metrics_tag=basic_info`
- `--columns <spec>` - Profile columns: simple `name:type,...` or full JSON array; prefix `@` to read JSON from file; 省略时自动获取表 schema 探查全部字段
- `--engine-strategy <strategy>` - Engine strategy (default: "auto")
- `--description <desc>` - Description
- `--where-condition <cond>` - SQL WHERE condition
- `--yarn-cluster <cluster>` - YARN cluster (e.g. `virtual-sg`)
- `--yarn-queue <queue>` - YARN queue (e.g. `root.example_queue`)
- `--queue-idc <idc>` - Queue IDC (default: "virtual")
- `--body-file <path>` - Full JSON request body file (overrides all other options)
- `--cookie <cookie>` - DataLeap cookie string (or set `BYTEDCLI_MANTA_COOKIE` env var)

**Examples:**

```bash
# SG region with inline columns
bytedcli manta profile rule create --region sg --db-name demo_db --tb-name demo_table --partitions date=20260331 --columns region:string,age:int --yarn-cluster virtual-sg --yarn-queue root.example_queue

# CN region
bytedcli manta profile rule create --region cn --db-name demo_db --tb-name demo_table --partitions date=20260401 --columns id:int,name:string --yarn-cluster virtual-cn --yarn-queue root.example_queue

# VA region
bytedcli manta profile rule create --region va --db-name demo_db --tb-name demo_table --partitions date=20260401 --columns id:int,name:string --yarn-cluster virtual-va --yarn-queue root.example_queue

# 多级分区探查
bytedcli manta profile rule create --region va --db-name demo_db --tb-name demo_table --partitions date=20260401/asset_type=sdk/metrics_tag=basic_info

# EU region
bytedcli manta profile rule create --region eu --db-name demo_db --tb-name demo_table --partitions date=20260401 --columns id:int,name:string --yarn-cluster virtual-eu --yarn-queue root.example_queue

# From JSON file
bytedcli manta profile rule create --body-file ./demo-profile-rule.json
```

**Notes:**
- `--partitions` 支持多级分区，用 `/` 分隔：`date=20260331/asset_type=sdk/metrics_tag=basic_info`
- `--partition-old` / `--partition-new` 同样支持多级分区格式
- `--columns` 省略时，自动调用 `getTableSchema` 获取全部字段并按类型生成默认 profile_list
- `--columns` 简写格式的 `profile_list` 按类型自动推导：string → `[null, enum, empty]`，numeric → `[null, enum, statistic, zero]`
- YARN 队列自动选取用户有权限的、负载最低的队列；也可通过 `--yarn-cluster`/`--yarn-queue` 显式指定
- On success, the response includes report URLs for each partition that can be opened to view profiling results

---

### comparison job create

Create a two-table data comparison job on the DataLeap Manta platform.

```bash
bytedcli manta comparison job create [options]
```

**Options:**
- `--region <region>` - Region (default: "cn")
- `--db-name-old <name>` - Old (baseline) database name (required unless `--body-file`)
- `--tb-name-old <name>` - Old (baseline) table name (required unless `--body-file`)
- `--partition-old <partition>` - Old table partition (e.g. `date=20260402`); multi-level: `date=20260402/asset_type=sdk/metrics_tag=v1`
- `--db-name-new <name>` - New (target) database name (required unless `--body-file`)
- `--tb-name-new <name>` - New (target) table name (required unless `--body-file`)
- `--partition-new <partition>` - New table partition (e.g. `date=20260403`); multi-level: `date=20260403/asset_type=sdk/metrics_tag=v2`
- `--primary-keys <keys>` - Primary key columns for JOIN; format: `col` or `col_old,col_new`; multiple separated by `;`. 未指定时自动推断并发出警告
- `--comparison-columns <cols>` - Comparison columns; format: `col` or `col_old,col_new,diff_type`; multiple separated by `;`. diff_type: `absolute_equal` | `number_diff`. 省略时对比所有共有字段
- `--where-condition-old <cond>` - SQL WHERE for old table
- `--where-condition-new <cond>` - SQL WHERE for new table
- `--yarn-queue <queue>` - YARN queue in format `region/idc/cluster/queue`; auto-detected if omitted
- `--body-file <path>` - Full JSON request body file (overrides all other options)
- `--cookie <cookie>` - DataLeap cookie string (or set `BYTEDCLI_MANTA_COOKIE` env var)

**Examples:**

```bash
# 同库同表不同分区对比，指定主键
bytedcli manta comparison job create --region va --db-name-old demo_db --tb-name-old demo_table --partition-old date=20260402 --db-name-new demo_db --tb-name-new demo_table --partition-new date=20260403 --primary-keys "id"

# 多级分区对比（用 / 分隔多级分区键）
bytedcli manta comparison job create --region va --db-name-old demo_db --tb-name-old demo_table --partition-old "date=20260402/asset_type=sdk/metrics_tag=v1" --db-name-new demo_db --tb-name-new demo_table --partition-new "date=20260402/asset_type=sdk/metrics_tag=v2" --primary-keys "id"

# 指定主键和对比列
bytedcli manta comparison job create --region sg --db-name-old demo_db --tb-name-old demo_table --partition-old date=20260402 --db-name-new demo_db --tb-name-new demo_table --partition-new date=20260403 --primary-keys "upstream_id;downstream_id" --comparison-columns "col_a;col_b;col_c"

# 通过 JSON 文件创建
bytedcli manta comparison job create --body-file ./demo-comparison.json
```

**Notes:**
- `--primary-keys` 控制 JOIN 匹配行（哪些列标识同一行），`--comparison-columns` 控制对比哪些字段的差异
- 主键必须由用户指定或确认，禁止猜测；未指定时 CLI 会自动推断并输出 `⚠` 警告
- 若指定了 `--comparison-columns` 但未指定 `--primary-keys`，对比列会自动从主键候选中排除
- YARN 队列自动选取用户有权限的、负载最低的队列；也可通过 `--yarn-queue` 显式指定（格式 `region/idc/cluster/queue`）
- On success, the response includes a comparison report URL that can be opened to view results

---

### comparison job get

Get a data comparison job result from the Manta comparison result endpoints.

```bash
bytedcli manta comparison job get [options]
```

**Options:**
- `--region <region>` - Region (default: "cn")
- `--instance-id <id>` - Comparison job instance ID (required)
- `--view <view>` - Result view: `summary` (default) or `overview`
- `--cookie <cookie>` - DataLeap cookie string (or set `BYTEDCLI_MANTA_COOKIE` env var)

**Examples:**

```bash
bytedcli manta comparison job get --region sg --instance-id 123456
bytedcli --json manta comparison job get --region mycis --instance-id 123456
bytedcli manta comparison job get --region mycis --instance-id 123456 --view overview
```

**Notes:**
- `--view summary` 调用 `GET /comparison/result-info?instance_id=...`，返回两表对比任务的概要信息
- `--view overview` 调用 `GET /comparison/result-overview?instance_id=...`，返回 overview 结果
- 文本模式会按顶层字段输出概要表，并附带 `view`；`--json` 保留原始返回结构，便于继续自动化处理
- 输出里附带 report URL，便于继续在浏览器中打开完整对比结果页

---

### comparison job diff-sql

Get the diff SQL for a specific compared field from the Manta `comparison/diff/sql` endpoint.

```bash
bytedcli manta comparison job diff-sql [options]
```

**Options:**
- `--region <region>` - Region (default: "cn")
- `--instance-id <id>` - Comparison job instance ID (required)
- `--old-column <name>` - Old-side field name (required)
- `--new-column <name>` - New-side field name (required)
- `--cookie <cookie>` - DataLeap cookie string (or set `BYTEDCLI_MANTA_COOKIE` env var)

**Examples:**

```bash
bytedcli manta comparison job diff-sql --region mycis --instance-id 49289 --old-column obj_type --new-column obj_type
bytedcli --json manta comparison job diff-sql --region mycis --instance-id 49289 --old-column obj_type --new-column obj_type
```

**Notes:**
- 该命令调用 `GET /comparison/diff/sql?instance_id=...&old_column=...&new_column=...`
- 适合查看某个字段差异明细所对应的 SQL，便于继续分析 diff 的来源或重放查询
- 文本模式会展示字段名与 SQL；`--json` 保留原始返回结构

---

### comparison sql create

Create a SQL-based data comparison job on the DataLeap Manta platform. Supports two modes: **auto-generate** (from table names, with map/array handling) and **raw SQL** (directly pass SQL statements).

```bash
bytedcli manta comparison sql create [options]
```

**Options:**
- `--region <region>` - Region (default: "cn")
- `--source-table <db.table>` - Source table in `database.table` format (auto-generate mode)
- `--target-table <db.table>` - Target table in `database.table` format (auto-generate mode)
- `--source-filter <condition>` - Source table WHERE condition (without `WHERE` keyword; auto-generate mode only)
- `--target-filter <condition>` - Target table WHERE condition (without `WHERE` keyword; auto-generate mode only)
- `--source-sql <sql>` - Raw source SQL statement (raw SQL mode; skips schema fetch)
- `--target-sql <sql>` - Raw target SQL statement (raw SQL mode; skips schema fetch)
- `--join-keys <keys>` - Join key columns, comma-separated (required unless `--body-file`)
- `--map-keys <spec>` - Map column keys: `col=key1,key2;col2=key3,key4`. Expands native Hive `map<>` fields via `col['key'] AS col_key` (auto-generate mode only)
- `--json-keys <spec>` - JSON string field keys: `col=key1,key2;col2=key3,key4`. Expands STRING fields containing JSON via `get_json_object(col, '$.key') AS col_key` (auto-generate mode only)
- `--dry-run` - Only generate/display SQL without submitting the job
- `--yarn-queue <queue>` - YARN queue in format `region/idc/cluster/queue`; auto-detected if omitted
- `--body-file <path>` - Full JSON request body file (overrides all other options)
- `--cookie <cookie>` - DataLeap cookie string (or set `BYTEDCLI_MANTA_COOKIE` env var)

**Examples:**

```bash
# 自动生成模式：同表不同条件的 SQL 比对
bytedcli manta comparison sql create --region cn --source-table demo_db.demo_table --target-table demo_db.demo_table --source-filter "date='20260405' and type='A'" --target-filter "date='20260405' and type='B'" --join-keys user_id

# 自动生成模式：展开 map 字段并预览 SQL（dry run）
bytedcli manta comparison sql create --region cn --source-table demo_db.demo_table --target-table demo_db.demo_table --source-filter "date='20260405'" --target-filter "date='20260404'" --join-keys user_id --map-keys "metrics=cpu,mem;tags=a,b" --dry-run

# 原始 SQL 模式：直接传 SQL 语句
bytedcli manta comparison sql create --region cn --source-sql "SELECT id, name, amount FROM demo_db.t WHERE date='20260405'" --target-sql "SELECT id, name, amount FROM demo_db.t WHERE date='20260404'" --join-keys id

# 原始 SQL 模式 + dry-run 预览
bytedcli manta comparison sql create --region cn --source-sql "SELECT id, name FROM demo_db.source_t WHERE dt='20260405'" --target-sql "SELECT id, name FROM demo_db.target_t WHERE dt='20260404'" --join-keys id --dry-run

# 提取 JSON 字符串字段的子 key 进行对比
bytedcli manta comparison sql create --region sg --source-table demo_db.demo_table --target-table demo_db.demo_table --source-filter "date='20260403'" --target-filter "date='20260402'" --join-keys uid --json-keys "props=type,status,label"

# 通过 JSON 文件
bytedcli manta comparison sql create --body-file ./demo-sql-comparison.json
```

**Notes:**
- `--source-sql/--target-sql` 与 `--source-table/--target-table` 互斥；前者为原始 SQL 模式（跳过 schema 查询），后者为自动生成模式
- 自动生成模式下，`map<>` 字段：如果指定了 `--map-keys`，每个 key 会展平为独立列 `col['key'] AS col_key`；未指定 keys 的 map 列保留原样
- 自动生成模式下，`--json-keys` 用于 STRING 类型但内容是 JSON 的字段，通过 `get_json_object(col, '$.key') AS col_key` 提取子 key 为独立对比列
- 自动生成模式下，`array<>` 字段：自动排序并拼接为字符串 `concat_ws(',', sort_array(col)) AS col_str`
- `--join-keys` 对应的列在 `field_details` 中标记为 `further_detail=false`（唯一键），其他列标记为 `further_detail=true`（查询 Diff 明细）
- API 端点使用 v1 `create_sql_rule`，与 `comparison job create` 的 `create-rule` 端点不同
- `--dry-run` 仅在本地生成并输出 SQL 和字段列表，不发起任何 API 请求
- On success, the response includes a comparison report URL

---

## Supported Regions

| Region | Description | API Base URL |
|--------|-------------|--------------|
| `cn` | China (default) | `https://data.bytedance.net/newmanta_api/v3` |
| `sg` | Singapore | `https://dataleap-sg.tiktok-row.net/newmanta_sg_api/v3` |
| `va` | US East (Virginia) | `https://dataleap-va.tiktok-row.net/newmanta_i18n_api/v3` |
| `eu` | EU | `https://dataleap.tiktok-eu.net/newmanta_tx_api/v3` |
| `mycis` | ByteIntl MYCIS | `https://dataleap-mycis.byteintl.net/newmanta_tx_api/v3` |

## Authentication

Manta uses DataLeap session cookies. Authentication methods (in priority order):

1. `BYTEDCLI_MANTA_COOKIE` environment variable
2. Saved session cookies from `bytedcli manta auth login`
3. SSO session bootstrap (auto-follows redirects from SSO to DataLeap)

Region-to-site mapping:
- `cn` → `prod` site (ByteDance SSO)
- `sg`, `va`, `eu` → `i18n-tt` site (TikTok SSO)
- `mycis` → `i18n-bd` site (ByteIntl SSO)

Ensure you are logged in for the target site:

```bash
# For cn region
bytedcli auth login

# For sg/va/eu regions (TikTok SSO)
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli auth login
```

Or use the dedicated Manta browser login for full cookie support:

```bash
bytedcli manta auth login --region sg
```
