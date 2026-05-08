---
name: bytedance-aeolus
description: "Query, explore, and edit Aeolus BI/data analytics datasets via bytedcli: list authorized datasets and dashboards, get dataset field details (dimensions and metrics), get dataset model info (underlying data source and query), add source table joins and expose fields, execute SQL queries, manage Query Editor files/folders for ad-hoc SQL execution (Hive or ClickHouse via --engine ch), and explore Shuttle data query projects, templates, tasks, and results with custom SQL support. Use when tasks mention Aeolus, BI dashboards, datasets, data analytics queries, Query Editor, Shuttle, or data templates."
---

# bytedcli Aeolus (Data Analytics Platform)

## 如何调用 bytedcli

先选择一种调用方式。下面所有示例默认直接写 `bytedcli`。

```bash
# 方式 1：直接用 npx 运行最新版
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]

# 方式 2：先全局安装，再直接调用 bytedcli
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli <command> [options]
```

- 使用 `npx` 时，把后文示例里的 `bytedcli` 替换成 `NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest`
- 已全局安装时，直接按后文示例执行 `bytedcli ...`

## When to use

- List dashboards and datasets you have access to
- Get dataset field details (dimensions and metrics)
- Get dataset model info (underlying data source, query, and table schema)
- Execute SQL queries against datasets
- Explore Aeolus BI platform data
- Manage Query Editor folders and query files (CRUD)
- Run ad-hoc SQL queries via Query Editor (Hive runner by default, or ClickHouse when SQL matches the browser Query Editor CH task, e.g. `params{'...'}`)
- Explore Shuttle data query projects, search templates, submit query tasks with custom SQL, check task results, and check YARN queue info

## 前置条件

- 使用通用调用方式：`references/invocation.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Supported Regions

Dataset / report API 默认域名与 `src/api/aeolus/site.ts` 一致；控制台入口可能因租户不同而异。

| Region      | Description                                    | Default API host                      |
| ----------- | ---------------------------------------------- | ------------------------------------- |
| `cn`        | China                                          | `https://data.bytedance.net`          |
| `sg`        | Singapore (TikTok row)                         | `https://aeolus-sg.tiktok-row.net`    |
| `va`        | US East (TikTok row)                           | `https://aeolus-va.tiktok-row.net`    |
| `mycis`     | MYCIS                                          | `https://aeolus-mycis.byteintl.net`   |
| `hrbimycis` | HRBI MYCIS (alias `hrbi_mycis` / `hrbi-mycis`) | `https://people-aeolus.byteintl.net`  |
| `mybd`      | MYBD                                           | `https://aeolus-mybd.sinf.net`        |
| `sglark`    | Singapore Lark                                 | `https://aeolus-sglark.bytedance.net` |
| `usttpusts` | US TTP USTS                                    | `https://aeolus-tx.tiktok-usts.net`   |

## Quick start

For report/dataQuery URLs, prefer this workflow by default:

1. `resolve-report` to get the dataset ID.
2. `dataset-fields` to confirm dimensions/metrics and partition fields.
3. `dataset-model-info` to inspect the underlying query and lineage.
4. If logical dataset SQL fails or only returns `dummy`, inspect `system.query_log` to locate the backing physical `aeolus_data_db_*`.`aeolus_data_table_*`.
5. Query the physical table directly.

```bash
# List authorized datasets and dashboards (region is required)
bytedcli aeolus list-authorized -r va --limit 20

# Filter by type (dashboard or data_set)
bytedcli aeolus list-authorized -r cn --type data_set

# Resolve a dataQuery/report URL to dataset IDs before querying
bytedcli aeolus resolve-report -r va --url "https://aeolus-va..."

# Get dataset field details (dimensions and metrics)
bytedcli aeolus dataset-fields -r va 1576311

# Get dataset model info (underlying query, lineage, source table / physical table hints)
bytedcli aeolus dataset-model-info -r va --app-id 1000252 --dataset-id 2109028

# Add a source table join and expose a metric; use --json + --dry-run to inspect payload first
bytedcli --json aeolus dataset-add-source-table -r cn --app-id <appId> --dataset-id <dataSetId> --db-name demo_db --table-name sample_table --join-from-table sample_prev_table --join-key key1 --join-key key2 --metric-field score --field-descr score=points --increment-field updated_at --dry-run

# Trigger an Aeolus dataFactory dataset sync/backfill range captured from the dataManage page
bytedcli aeolus dataset-sync trigger -r cn --app-id <appId> --dataset-id <dataSetId> --start-date "2026-04-22 00" --end-date "2026-05-06 23" --queue-name root.demo_queue --max-parallelism 5

# Check sync/backfill instance status for the same business time range
bytedcli aeolus dataset-sync status -r cn --app-id <appId> --dataset-id <dataSetId> --start-date "2026-04-22 00" --end-date "2026-05-06 23"

# If direct logical SQL fails, inspect query_log to find the actual physical table name
bytedcli aeolus query -r va 1576311 "SELECT event_time, query FROM system.query_log WHERE query LIKE '%aeolus_data_table_%' ORDER BY event_time DESC LIMIT 20"

# Query the physical Aeolus table directly after locating it
bytedcli aeolus query -r va 1576311 "SELECT reporting_ad_id, max(pangle_rolling3d_dollar_cost) AS pangle_rolling3d_dollar_cost FROM \`aeolus_data_db_xxx\`.\`aeolus_data_table_xxx\` WHERE p_date = '2026-03-01' GROUP BY reporting_ad_id ORDER BY pangle_rolling3d_dollar_cost DESC LIMIT 10"
```

## Recommended workflow for report/dataQuery links

1. Use `resolve-report` to get the dataset ID from the report URL.
2. Use `dataset-fields` to confirm dimensions/metrics and identify partition fields.
3. Always use `dataset-model-info` before assuming logical dataset SQL will work. Many Aeolus datasets expose derived fields in metadata, but `aeolus query` may only succeed against the backing physical ClickHouse table, not a logical dataset alias like `[DatasetName]` or `"2231500"`.
4. If direct logical dataset SQL fails with errors like `unknownTable`, `unknownIdentifier`, or only returns `dummy`, inspect:
   - `modelInfo.nodeConf[].query` for the source logic
   - `modelInfo.nodeConf[].lineageInfo` for upstream tables
   - `system.query_log` via `aeolus query` to find the real physical table name used by Aeolus (often `aeolus_data_db_*`.`aeolus_data_table_*`)
5. Query the physical Aeolus table directly, and deduplicate with `GROUP BY` / `max(...)` when repeated rows exist per key.
6. Do not stop at `SELECT * LIMIT 1` returning only `dummy`; that usually means you still need the physical table, not that the dataset is unusable.

### Failure signatures

- `unknownTable` when using a logical dataset name or dataset ID as the table
- `unknownIdentifier` / missing field errors even though the field exists in `dataset-fields`
- `SELECT * LIMIT 1` or `select dummy` only returning a `dummy` column

These are all strong signals to switch from logical dataset SQL to physical-table discovery.

### End-to-end fallback example

```bash
# 1) Resolve the report URL
bytedcli aeolus resolve-report -r va --url "https://aeolus-va..."

# 2) Inspect semantic fields and partition fields
bytedcli aeolus dataset-fields -r va 2231500

# 3) Inspect the underlying model/query
bytedcli aeolus dataset-model-info -r va --app-id 555116 --dataset-id 2231500

# 4) Find the backing physical table from recent Aeolus queries
bytedcli aeolus query -r va 2231500 "SELECT event_time, query FROM system.query_log WHERE query LIKE '%aeolus_data_table_%' ORDER BY event_time DESC LIMIT 50"

# 5) Query the physical table directly
bytedcli aeolus query -r va 2231500 "SELECT reporting_ad_id, sum(placement_dollar_cost_1d/100000) AS cost FROM \`aeolus_data_db_xxx\`.\`aeolus_data_table_xxx\` WHERE p_date = '2026-04-07' AND placement = 'Pangle' GROUP BY reporting_ad_id ORDER BY cost DESC LIMIT 5"
```

## Dataset VizQuery (无需写 SQL 的数据集可视化查询)

`aeolus viz-query` 对应浏览器里 Aeolus 报表/数据集页面发起的 `POST /aeolus/vqs/api/v2/vizQuery/query`，
走和 `aeolus query` 一致的 Titan Passport cookie 鉴权。因此它在 `hrbi_mycis` 等
没有 Query Editor 权限的 region 上也能工作，非常适合：

- 只想快速拿某个 dataset 的 row count / 单维度聚合结果；
- 浏览器抓到一份 payload，想复用结构化参数而不是自己拼 SQL；
- 需要和 Aeolus 前端行为完全一致（含权限与过滤下推）。

默认情况下不需要显式传 `--data-source-id`。当某些数据集在 CLI 构造请求下仍返回
`aeolus/unknown`，并且你在浏览器抓到的成功 payload 明确包含 `dataSourceId` 时，
再把该值作为 `--data-source-id` 传入，或直接复用整份 `--body-file`。

实现和排障上还有几个关键点：

- 鉴权优先复用 Titan Passport cookie（与 `aeolus query` 同一路径），避免依赖 QE session，这样才能覆盖 `hrbi_mycis` 等没有 Query Editor 权限的 region。
- 请求体需要补齐顶层 `schema`、`display`、`originalSchema`；服务端会校验这些字段是否存在。
- 响应的真实数据行通常在 `data.vizData.datasets[]`，键名是各字段 `unique_id` 的字符串形式；解析时需要结合 `data.columns[]` 元数据重建列顺序。
- 若无 `--body-file`，默认构造应尽量贴近浏览器 payload：维度列优先使用原始 `dimMetId` 作为 `id` / `groupById` / `locations.dimensions`，指标列保留聚合前缀 id（如 `count_159...`），并默认带浏览器常见的 table `display.conf` / `fieldsFormat` 与 schema where filter 包装。

### Quick start

一维 count（对应用户示例：dataset=2889 昨日数据条数）：

```bash
bytedcli --site i18n-bd aeolus viz-query \
  -r hrbi_mycis --app-id 667 --dataset-id 2889 \
  --dim-met '{"dimMetId":1590328014122,"name":"app_id","expr":"`app_id`","roleType":1,"aggregation":"count(","dataType":"int"}' \
  --where '{"dimMetId":1590328014119,"name":"partition_date","op":"lastSync","val":[1],"valOption":{"datetimeUnit":"day","anchorOffset":0}}'
```

参数说明：

- `--dim-met`（可重复）：一个维度或指标，推荐 JSON 对象形式。必填 `dimMetId` / `name` / `expr`；
  `roleType=0` 为维度、`1` 为指标；指标请同时带 `aggregation`（如 `count(` / `sum(`）。
  也支持紧凑的 `dimMetId=1,name=xxx,expr=\`xxx\`,roleType=1,aggr=count(`。
- `--where`（可重复）：筛选条件 JSON，需 `name` / `dimMetId` / `op` / `val`（数组）。
- `--limit`：行数上限，默认 1000。
- `--timeout-ms`：单次请求超时，单位毫秒；适合大数据集或高峰期查询较慢时显式放宽。
- `--transform`：`table`（默认）或 `chart`。

### `hrbi_mycis` 使用提示

- 如果 `dataset-fields` 在 `hrbi_mycis` 返回 `aeolus/clickhouse/invalidRequest`，优先改查同名的迁移数据集。
- 很多 ClickHouse 数据集会强制要求命中日期分区；直接执行 `viz-query` 时，优先补 `partition_date` 过滤，否则容易报 `force_index_by_date`。
- 例如查询 `用户权限删除记录数据集（MY 迁移）` 的 `new_emp_id` 时，可以这样写：

```bash
bytedcli --site i18n-bd aeolus viz-query \
  -r hrbi_mycis --app-id 667 --dataset-id 2892 \
  --dim-met '{"dimMetId":1590328014236,"name":"new_emp_id","expr":"`new_emp_id`","roleType":0,"dataType":"string"}' \
  --where '{"dimMetId":1590328014230,"name":"partition_date","op":"lastSync","val":[1],"valOption":{"datetimeUnit":"day","anchorOffset":0}}'
```

### 复用浏览器 payload

如果直接抓到浏览器的完整 payload，可以整段丢给 `--body` 或 `--body-file`：

```bash
bytedcli --site i18n-bd aeolus viz-query \
  -r hrbi_mycis --app-id 667 --dataset-id 2889 \
  --timeout-ms 90000 \
  --body-file ./payload.json
```

`requestId` 会自动替换为 CLI 生成的新值；其余字段（`schema`、`display`、`originalSchema` 等）保持不变。

## SQL Syntax Notes

- Do **not** assume ``FROM `[DatasetName]` `` or `FROM "<datasetId>"` will work. For many datasets this returns `unknownTable`.
- `dataset-fields` lists semantic fields, but not every field name can be queried directly without first locating the physical Aeolus table.
- If `SELECT * LIMIT 1` returns only `dummy`, that does **not** prove the dataset is unusable; it usually means you are not yet querying the backing table.
- Prefer physical-table SQL once you have identified the actual table name from `system.query_log` or dataset model info.
- Partition fields must still be included in `WHERE` clauses where applicable.

## Authentication

By default, Aeolus commands reuse the token obtained from `bytedcli auth login`, just like most other bytedcli domains.

For most Dataset API commands, you can optionally configure region-specific `ClientID/ClientSecret` in `.aeolus.env` or environment variables. When present, CLI will prefer those credentials, which is useful for automation:

1. Visit the Aeolus Developer Console to get your ClientID and ClientSecret（域名以租户为准，常见如下）:
   - **CN region**: [data.bytedance.net](https://data.bytedance.net/aeolus/pages/developer/console/certification)
   - **SG region**: [aeolus-sg.tiktok-row.net](https://aeolus-sg.tiktok-row.net/pages/developer/console/certification)
   - **VA region**: [aeolus-va.tiktok-row.net](https://aeolus-va.tiktok-row.net/pages/developer/console/certification)
2. Create `.aeolus.env` file (choose one location):
   - **Global**: `~/.bytedcli/.aeolus.env` (recommended for npm global install)
   - **Local**: `./.aeolus.env` in current working directory (overrides global)

```bash
# Region-specific credentials
BYTEDCLI_AEOLUS_CN_CLIENT_ID=your_cn_client_id
BYTEDCLI_AEOLUS_CN_CLIENT_SECRET=your_cn_client_secret
BYTEDCLI_AEOLUS_SG_CLIENT_ID=your_sg_client_id
BYTEDCLI_AEOLUS_SG_CLIENT_SECRET=your_sg_client_secret
BYTEDCLI_AEOLUS_VA_CLIENT_ID=your_va_client_id
BYTEDCLI_AEOLUS_VA_CLIENT_SECRET=your_va_client_secret
```

## Query Editor (ad-hoc SQL)

Query Editor defaults to the authentication result obtained from `bytedcli auth login`, but it does not support region-specific `ClientID/ClientSecret` overrides. It defaults to `cn`, and also supports `-r/--region` to switch between `cn`, `sg`, `va`, `mycis`, `hrbimycis`, `mybd`, `sglark`, and `usttpusts`. For `mycis` and `mybd`, Query Editor reuses the local browser session for `i18n-bd`. For `usttpusts`, it reuses the local browser session for `us-ttp-usts`. For `hrbimycis`, bytedcli only supports dataset visual queries through `aeolus viz-query`.

### Authentication

```bash
# One-time login
bytedcli auth login

# Query Editor on mycis / mybd
bytedcli --site i18n-bd auth login --session
```

Cookies are cached locally and reused until expiry (~14 days). For `mycis` and `mybd`, make sure the `i18n-bd` browser session is ready first. For `usttpusts`, make sure the `us-ttp-usts` browser session is ready first. For `hrbimycis`, use `aeolus viz-query` instead of Query Editor or `aeolus query`.

### Quick start

```bash
# Check current user
bytedcli aeolus query-editor whoami
bytedcli aeolus query-editor whoami --region sg

# Folder management
bytedcli aeolus query-editor folder list
bytedcli aeolus query-editor folder list --region va
bytedcli aeolus query-editor folder tree
bytedcli aeolus query-editor folder create --name "my-queries"

# File management
bytedcli aeolus query-editor file create --name "test" --folder-id 123
bytedcli aeolus query-editor file write-sql --file-id 456 --sql "SELECT 1"
bytedcli aeolus query-editor file search --keyword "test"

# SQL execution
bytedcli aeolus query-editor query run --file-id 456 --folder-id 123 --sql "SELECT 1"
bytedcli aeolus query-editor query run --file-id 456 --folder-id 123 --file ./queries/demo.sql
bytedcli aeolus query-editor query status --task-id 789 --file-id 456 --folder-id 123
bytedcli aeolus query-editor query logs --task-id 789

# One-shot query (auto-creates file, runs SQL, returns results)
bytedcli aeolus query-editor query one --sql "SELECT 1"
```

### Query Editor: ClickHouse (`--engine ch`)

默认走 Hive `/hive/task/run`；与浏览器 Query Editor 一致的 ClickHouse 任务请用 **`--engine ch`**（`/ch/task/*`）、并保证 **`status` / `logs` 与 `run` 使用相同 `--engine`**。参数表、`QE_APP_ID`、`BYTEDCLI_CLOUD_SITE`（VA/SG 常为 `i18n-tt`）等完整说明见 **`references/aeolus.md` 的「Query Editor」章节**。

### Recommended usage: `query one` vs full Query Editor workflow

- Use `aeolus query-editor query one` for one-off or exploratory SQL where you only need to run a small number of temporary queries quickly.
- Use the full Query Editor workflow when you are analyzing one system or topic and expect multiple related SQL queries over time.
- The full workflow avoids creating a new temporary folder on every query, lets you reuse the same folder/file IDs, and keeps related SQL under one theme directory so you can search and review query history later.
- In the full workflow, prefer passing SQL directly to `query run --sql ...` or `query run --file ...`. Writing SQL into the file first is optional, not required for execution.
- Under the hood, both `query run --sql ...` and `query run --file ...` call the same Query Editor `run` API with the same `page_id` / `block_id`; **Hive** (default) sends `yarn` queue fields, while **`--engine ch`** sends `cluster_name` / `region` instead. The only difference between `--sql` and `--file` is where `query` / `query_template` text comes from.
- A practical organization pattern is: create one folder for the overall analysis theme, create multiple files for different sub-scenarios under that theme, and then reuse the same `file-id` for multiple `query run` executions when one sub-scenario needs several SQL variants.
- In that model, `folder-id` is the theme container, and `file-id` is closer to a reusable query context for one sub-scenario than a hard binding to exactly one SQL statement.

Recommended persistent workflow:

```bash
# 1) Create or reuse a theme folder once
bytedcli aeolus query-editor folder create --name "svc-frk-analysis"

# 2) Create one or more query files inside that folder
bytedcli aeolus query-editor file create --name "partitions" --folder-id 123
bytedcli aeolus query-editor file create --name "daily-sample" --folder-id 123
bytedcli aeolus query-editor file create --name "rootcause-drilldown" --folder-id 123

# 3) Run queries against the same reusable file/folder IDs
bytedcli aeolus query-editor query run --file-id 456 --folder-id 123 --sql "SHOW PARTITIONS svc_frk.ods_cp_cds_keys_df"
bytedcli aeolus query-editor query run --file-id 457 --folder-id 123 --sql "SELECT * FROM svc_frk.ods_cp_cds_keys_df WHERE date = '20260412' LIMIT 100"
bytedcli aeolus query-editor query run --file-id 457 --folder-id 123 --file ./queries/daily-sample.sql
bytedcli aeolus query-editor query run --file-id 458 --folder-id 123 --sql "SELECT protocol, date FROM svc_frk.ods_cp_cds_keys_usttp_df WHERE date = '20260412' LIMIT 10"
bytedcli aeolus query-editor query run --file-id 458 --folder-id 123 --sql "SELECT to_service, count(*) FROM svc_frk.ods_cp_cds_keys_usttp_df WHERE date = '20260412' GROUP BY to_service LIMIT 20"

# 4) Optionally persist SQL into the file body for later viewing/editing in Query Editor UI
bytedcli aeolus query-editor file write-sql --file-id 456 --sql "SHOW PARTITIONS svc_frk.ods_cp_cds_keys_df"
bytedcli aeolus query-editor file write-sql --file-id 457 --sql "SELECT * FROM svc_frk.ods_cp_cds_keys_df WHERE date = '20260412' LIMIT 100"

# 5) Inspect task status / logs and search historical SQL files later
bytedcli aeolus query-editor query status --task-id 789 --file-id 456 --folder-id 123
bytedcli aeolus query-editor query logs --task-id 789
bytedcli aeolus query-editor file search --keyword "svc_frk"
```

Notes:

- `query one` is optimized for convenience, not long-term organization.
- `query run` should include `--sql` or `--file` when you want to execute against an existing `file-id` / `folder-id`.
- For repeated analysis, prefer naming folders by topic/system (for example `svc-frk-analysis`, `creator-growth-debug`, `dashboard-245033-rootcause`).
- Query Editor commands default to `cn`, and support `-r/--region` to switch host/domain consistently with Aeolus dataset/report APIs.

### Command structure

```
aeolus query-editor
  ├── whoami / queues / datasources
  ├── folder  list|tree|create|rename|move|delete
  ├── file    get|create|write-sql|rename|move|delete|search
  └── query   run|status|logs|one
```

## Shuttle (Data Query Projects)

Shuttle 是 Aeolus 平台上的数据查询项目管理工具，支持按项目组织查询模板、提交查询任务、查看任务结果和 YARN 队列资源。支持通过 `--query` 自定义 SQL（自动创建临时模板）。

### Quick start

```bash
# 列出 Shuttle 项目
bytedcli aeolus shuttle project list -r va
bytedcli aeolus shuttle project list -r va --keyword "example" --limit 20

# 搜索模板
bytedcli aeolus shuttle template search -r va --keyword "detection"
bytedcli aeolus shuttle template search -r va --project-id 1233 --creator "username"

# 查看模板详情（含 SQL、参数、DECC 合规信息）
bytedcli aeolus shuttle template get -r va --template-id 309328

# 查看任务详情（含各 region 状态、引擎、结果行数）
bytedcli aeolus shuttle task get -r va --task-id 2495756

# 查看任务结果（返回查询结果的列和行）
bytedcli aeolus shuttle task result -r va --task-id 2495756

# 提交查询任务（使用模板已有 SQL）
bytedcli aeolus shuttle task submit -r va --template-id 309328 --project-id 1233 --start-date 2026-04-25 --end-date 2026-04-28

# 提交查询任务（使用自定义 SQL，自动创建临时模板）
bytedcli aeolus shuttle task submit -r va --template-id 309328 --project-id 1233 --query "SELECT count(DISTINCT user_id) AS uv FROM demo_table WHERE p_date >= '20260425'"

# 创建新模板
bytedcli aeolus shuttle template create -r va --name "my_template" --project-id 1233 --query "SELECT 1"
# 从已有模板克隆 DECC 合规信息
bytedcli aeolus shuttle template create -r va --name "my_template" --project-id 1233 --query "SELECT 1" --clone-template-id 309328

# 查看 YARN 队列资源
bytedcli aeolus shuttle queue get -r va --project-id 1233
```

### Command structure

```
aeolus shuttle
  ├── project
  │   └── list           List Shuttle projects
  ├── template
  │   ├── search         Search Shuttle templates
  │   ├── get            Get template detail (SQL, params, DECC info)
  │   └── create         Create a new template (--clone-template-id to copy DECC schema)
  ├── task
  │   ├── get            Get task detail (status, engine, region info)
  │   ├── result         Get task query result (columns and rows)
  │   └── submit         Submit a query task (--query for custom SQL)
  └── queue
      └── get            Get YARN queue info for a project
```

### Notes

- Shuttle 命令复用 Aeolus 认证（`bytedcli auth login` 或 region-specific `ClientID/ClientSecret`）。
- `project list` 返回项目 ID、名称、描述、权限和创建者信息。
- `template search` 支持 `--keyword`、`--project-id`、`--creator`、`--only-favored` 等过滤条件，分页通过 `--page` / `--per-page` 控制。
- `template get` 返回模板绑定的 SQL（`query` 字段）、参数定义（`params`）和各 region 的 DECC 合规信息（`deccSchemaId`）。
- `task result` 从任务详情中提取 `infos.{REGION}.result`，返回列名和数据行。
- `task submit` 支持两种模式：
  - 不带 `--query`：使用模板已有 SQL，自动替换 `${date}` / `${date-N}` 日期变量。
  - 带 `--query`：自动创建临时模板（从 `--template-id` 克隆 DECC 合规信息），用自定义 SQL 提交任务。
- `template create` 新建模板。如果需要 DECC 数据合规审批，用 `--clone-template-id` 从已有模板复制 `deccSchemaId`，否则新建的模板可能无法提交任务。
- `queue get` 显示项目在各 region 的 YARN 队列资源使用率、可用内存、等待任务数等。

## Notes

- Use `--json` for structured JSON output (global option before subcommand)
- **Region (`-r`) is required** for all Dataset API commands
- Dataset ID can be found in `list-authorized` output
- App ID can be found in `list-authorized` JSON output (`app.id` field)
- Partition fields are marked in `dataset-fields` output
- `dataset-fields`, `dataset-model-info` and `query` only work with `data_set` type, not `dashboard`
- Query Editor commands default to `cn`; pass `-r/--region <region>` to target `sg`, `va`, `mycis`, `hrbimycis`, `mybd`, `sglark`, or `usttpusts`

## References

- `references/aeolus.md`（命令级参考；含 **Query Editor**、`--engine ch`、Regions 与鉴权）
- `references/invocation.md`
