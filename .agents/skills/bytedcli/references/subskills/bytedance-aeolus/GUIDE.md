---
name: bytedance-aeolus
description: "Query, explore, and edit Aeolus BI/data analytics datasets via bytedcli: list authorized datasets and dashboards, get dataset field details (dimensions and metrics), get dataset model info (underlying data source and query), add source table joins and expose fields, execute SQL queries, manage Query Editor files/folders for ad-hoc SQL execution (Hive or ClickHouse via --engine ch), and explore Shuttle data query projects, search/create/delete/move templates, organise saved templates into folders (list/tree/create/delete/move/rename), submit query tasks with custom SQL, check task results, and download full-result Excel/CSV files. Use when tasks mention Aeolus, BI dashboards, datasets, data analytics queries, Query Editor, Shuttle, or data templates."
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
- Explore Shuttle data query projects, submit query tasks (template SQL or custom `--query`), check task results, download full result files (Excel/CSV), and check YARN queue info
- Save and organise Shuttle SQL templates into a folder hierarchy under a project: search / create / move / delete templates, plus list / tree / create / rename / move / delete folders (Shuttle has no public template-rename endpoint — re-create with the new name and delete the old one)

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
| `usbd`      | US ByteDance                                   | `https://aeolus-usbd.byteintl.net`    |

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
- 若需要对 `hrbi_mycis` 等 region 增加仓库内本地策略限制，统一走 `src/services/aeolus/policy.ts` + `config/aeolus/aeolus_policy.json`，并在 handler 调用真实 API 前集中校验；不要把用户名、dataset allowlist 或 region 特判硬编码到 `src/api/*`、command 层或多个 handler 分支里。用户身份优先复用 `~/.local/share/bytedcli/data/userinfo.json`，缺失时再提示执行 `bytedcli auth userinfo`。
- Aeolus 这类随仓库固定交付的策略文件，默认放在 `config/aeolus/` 下，并通过 `src/utils/package_root.ts#getPackageRoot()` 从项目根目录读取；环境变量 override 只作为测试或临时调试兜底，不要再把项目级策略默认放到 `~/.local/share/bytedcli/data/`。
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

Query Editor defaults to the authentication result obtained from `bytedcli auth login`, but it does not support region-specific `ClientID/ClientSecret` overrides. It defaults to `cn`, and also supports `-r/--region` to switch between `cn`, `sg`, `va`, `mycis`, `hrbimycis`, `mybd`, `sglark`, `usttpusts`, and `usbd`. For `mycis`, `mybd`, and `usbd`, Query Editor reuses the local browser session for `i18n-bd`. For `usttpusts`, it reuses the local browser session for `us-ttp-usts`. For `hrbimycis`, bytedcli only supports dataset visual queries through `aeolus viz-query`.

### Authentication

```bash
# One-time login
bytedcli auth login

# Query Editor on mycis / mybd / usbd
bytedcli --site i18n-bd auth login --session
```

Cookies are cached locally and reused until expiry (~14 days). For `mycis`, `mybd`, and `usbd`, make sure the `i18n-bd` browser session is ready first. For `usttpusts`, make sure the `us-ttp-usts` browser session is ready first. For `hrbimycis`, use `aeolus viz-query` instead of Query Editor or `aeolus query`.

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

Shuttle 是 Aeolus 平台上的数据查询项目管理工具。按项目组织查询模板，用模板已有 SQL 或 `--query`/`--query-file` 自定义 SQL 提交查询任务，再回看任务结果、下载完整结果文件。同一项目下的模板可以归档进「我的模板」侧栏的文件夹层级里，所以创建/重命名/移动/删除模板与文件夹的命令成对存在。

### Quick start

```bash
# 项目与队列资源
bytedcli aeolus shuttle project list -r va
bytedcli aeolus shuttle project list -r va --keyword "example" --limit 20
bytedcli aeolus shuttle queue   get  -r va --project-id 1233

# 搜索 / 查看模板（搜索要求 --project-id）
bytedcli aeolus shuttle template search -r va --project-id 1233 --keyword "detection"
bytedcli aeolus shuttle template search -r va --project-id 1233 --creator "username"
bytedcli aeolus shuttle template get    -r va --template-id 100100

# 提交查询任务
# - 用模板已有 SQL：BATCH 基板可加 --start-date/--end-date 范围；ADHOC 基板不接受范围
bytedcli aeolus shuttle task submit -r va --template-id 100100 --project-id 1233 --start-date 2026-04-25 --end-date 2026-04-28
# - 用自定义 SQL：CLI 在内部创建一次性临时模板（不进侧栏「我的模板」），继承 --template-id 的 taskType/dataSource/engine 与 DECC infos
bytedcli aeolus shuttle task submit -r va --template-id 100100 --project-id 1233 --query "SELECT count(DISTINCT user_id) AS uv FROM demo_table WHERE p_date >= '20260425'"

# 查看 / 下载任务结果（--shuttle-region 是任务详情 infos 的 key，与 -r/--region 无关）
bytedcli aeolus shuttle task get      -r va --task-id 200200
bytedcli aeolus shuttle task result   -r va --task-id 200200
bytedcli aeolus shuttle task download -r va --task-id 200200 --shuttle-region US --fmt excel -o ./demo-shuttle-export.xlsx
bytedcli aeolus shuttle task download -r va --task-id 200200 --shuttle-region EU --fmt csv   -o ./demo-shuttle-export.csv --timeout-ms 240000

# 新建模板（默认进入项目根目录下的「我的模板」侧栏）
bytedcli aeolus shuttle template create -r va --project-id 1233 --name "my_template" --query "SELECT 1"
# 需要 DECC 合规审批：用 --clone-template-id 从已有模板复制 deccSchemaId / taskType / dataSource / engine
bytedcli aeolus shuttle template create -r va --project-id 1233 --name "my_template" --query "SELECT 1" --clone-template-id 100100
# 克隆的是 BATCH 基板：必须显式给日期范围，否则后端会因缺少范围而报错
bytedcli aeolus shuttle template create -r va --project-id 1233 --name "my_template" --query "SELECT 1" --clone-template-id 100200 --start-date 2026-04-25 --end-date 2026-04-28
# 不依赖任何已有模板：直接用 --decc-schema-id 绑定一个已知的 DECC schema，CLI 客户端构造 infos
# 适合：已知目标 region 的 deccSchemaId，又不想为找一个"合适的 clone 源 template"花时间排查
# （HDFS vs MQ channel、infos.region 是否匹配目标机房等）
bytedcli aeolus shuttle template create -r va --project-id 1233 --name "demo_us_template" --query-file ./uv.sql \
  --decc-schema-id <us_schema_id> --decc-region US --decc-channel-type HDFS
# 其他 region 同样直接绑（注意 schemaId 与 region 都换成目标区的）
bytedcli aeolus shuttle template create -r va --project-id 1233 --name "demo_eu_template" --query-file ./uv.sql \
  --decc-schema-id <eu_schema_id> --decc-region EU --decc-channel-type HDFS

# 整理「我的模板」目录树
#   folder 用 --folder-id / --parent-id / --target-parent-id；template move 用 --target-folder-id
#   "项目根目录" 在 CLI 里有两种等价写法：省略目标 ID flag，或显式传 0（CLI 内部会翻译成后端的 null parent）
bytedcli aeolus shuttle folder tree   -r va --project-id 1233
bytedcli aeolus shuttle folder list   -r va --project-id 1233                          # 列项目根目录
bytedcli aeolus shuttle folder list   -r va --project-id 1233 --folder-id 4521         # 列指定文件夹下的内容
bytedcli aeolus shuttle folder create -r va --project-id 1233 --name "demo_folder"     # 在项目根目录新建
bytedcli aeolus shuttle folder create -r va --project-id 1233 --name "sub" --parent-id 4521
bytedcli aeolus shuttle folder rename -r va --project-id 1233 --folder-id 4521 --name "renamed_folder"
bytedcli aeolus shuttle folder move   -r va --project-id 1233 --folder-id 4521 --target-parent-id 0   # 移回根目录
bytedcli aeolus shuttle folder delete -r va --project-id 1233 --folder-id 4521                     # 必须先清空

# Shuttle 没有 template rename API；要改名请「重新 create + 删旧」。
bytedcli aeolus shuttle template move   -r va --project-id 1233 --template-id 100100 --target-folder-id 4521
bytedcli aeolus shuttle template move   -r va --project-id 1233 --template-id 100100 --target-folder-id 0   # 移回根目录
# 删除模板：模板若在文件夹里，传 --project-id 让 CLI 先把它从父文件夹解绑（避免父文件夹之后无法 delete）
bytedcli aeolus shuttle template delete -r va --template-id 100100 --project-id 1233
```

#### 把一段 SQL 保存到指定文件夹（save 等价流程）

CLI 没有单条 `save`；`template create` 也不接受 `--parent-id`/`--folder-id`。要按"命名 + 路径"保存 SQL，组合两步即可：

```bash
# 1) 先准备目标文件夹（已存在就跳过这步，直接复用其 folderId）
bytedcli aeolus shuttle folder tree   -r va --project-id 1233
bytedcli aeolus shuttle folder create -r va --project-id 1233 --name "kb-saved-sql"   # 记下返回的 folderId（例：4521）

# 2) 创建模板（先在根目录），再移入目标文件夹
bytedcli aeolus shuttle template create -r va --project-id 1233 --name "uv_by_country" --query-file ./uv.sql
bytedcli aeolus shuttle template move   -r va --project-id 1233 --template-id <newTemplateId> --target-folder-id 4521
```

### Command structure

```
aeolus shuttle
  ├── project list                                              List Shuttle projects
  ├── queue   get                                               YARN queue info for a project
  ├── template
  │   ├── search    (--project-id required)                     Search templates
  │   ├── get                                                   Template detail (SQL, params, DECC)
  │   ├── create    (default taskType=BATCH → --start-date/--end-date required)  Create template; clone DECC via --clone-template-id, OR bind directly via --decc-schema-id + --decc-region
  │   ├── delete    (--project-id detaches from parent folder)  Delete a template
  │   └── move      (--target-folder-id; omit or 0 = project root)  Move template into / out of a folder
  │   (no rename — Shuttle has no public template-rename endpoint; re-create + delete)
  ├── folder
  │   ├── list      (--folder-id; omit = project root)          List a folder's direct children
  │   ├── tree                                                  Full folder/template tree
  │   ├── create    (--parent-id; omit = project root)          Create a new folder
  │   ├── delete                                                Delete an empty folder
  │   ├── move      (--target-parent-id; omit or 0 = project root) Move a folder under another parent
  │   └── rename                                                Rename a folder
  └── task
      ├── get                                                   Task detail (status, engine, region info)
      ├── result                                                Task query result (columns + rows)
      ├── download  (--fmt excel|csv, --shuttle-region <code>)  Save full result file to disk
      └── submit    (--query / --query-file for custom SQL)     Submit a query task
```

### Notes

- Shuttle 命令复用 Aeolus 认证（`bytedcli auth login` 或 region-specific `ClientID/ClientSecret`）。
- `template search` 必填 `--project-id`，并支持 `--keyword` / `--creator` / `--only-favored` / `--page` / `--per-page`。
- `template get` 返回模板 SQL（`query`）、参数定义（`params`，兼容 `name`/`defaultValue` 与 `key`/`value` 两种字段形态）、以及各 region 的 DECC 合规信息（`deccSchemaId`）。
- `task submit` 有两种模式：
  - 不带 `--query` / `--query-file`：使用模板已有 SQL，占位符支持 `${name}` 与 `{{name}}`（`${date}` / `${date-N}`、`{{date}}` / `{{date-N}}` 由 CLI 按 `--end-date` 展开），`--var key=value` 覆盖模板参数默认值。
  - 带 `--query` / `--query-file`：CLI 从 `--template-id` 拉详情，创建一次性临时模板时继承 `taskType` / `dataSource` / `engine` 与 DECC `infos`，模板不会进入「我的模板」侧栏。**自定义 SQL 必须产出与源模板 DECC schema 一致的列**（例如 `score_bucket` / `commission_rate` / `detection_uv` + `COUNT(DISTINCT author_id)`），否则后端会返回误导的 `invalidTemplateSnapshotException: failed to parse the template sql`。
  - **ADHOC 基板 + `--start-date` / `--end-date` 会立即报错**：ADHOC 单日任务不接受范围，需要范围请改用 BATCH 基板。
- `template create` 默认 `taskType=BATCH` 进入「我的模板」侧栏（项目根目录），**所以无论是否使用 `--clone-template-id` 都必须传 `--start-date` / `--end-date`**——后端会因缺少范围而 NPE。需要 DECC 审批时用 `--clone-template-id` 复制源模板的 `deccSchemaId` 与 `taskType` / `dataSource` / `engine`（如果克隆的是 ADHOC 基板则不需要日期范围）。CLI 没有 `save` 命令；要保存到具体文件夹用上面的「save 等价流程」。
- **`--decc-schema-id` 直接绑定（不依赖已有模板）**：当你已知目标 region 的 `deccSchemaId` 时，可用 `--decc-schema-id <id> --decc-region <US|EU|EU-TTP2|...> [--decc-channel-type HDFS|MQ] [--decc-status approved]` 直接构造 `infos` 绑定 DECC schema。规则：
  - 与 `--clone-template-id` **互斥**（同时传报 `SHUTTLE_TEMPLATE_CREATE_CONFLICTING_OPTIONS`）
  - `--decc-region` 必填（缺则报 `SHUTTLE_TEMPLATE_CREATE_MISSING_REGION`）
  - `--decc-channel-type` 默认 `HDFS`，`--decc-status` 默认 `approved`
  - 走该路径时 CLI 自动设 `taskType=ADHOC` / `dataSource=HIVE` / `engine=Auto`——避免 BATCH 默认值在缺 range 时触发后端 NPE；要做 BATCH 时仍可叠加 `--start-date` / `--end-date`
  - SQL 输出列仍受 DECC schema 字段池约束（同 clone 路径），不匹配后端会回 `invalidTemplateSnapshotException`
- 文件夹与模板归档：
  - 顶层（项目根目录）在 CLI 里有两种等价写法——省略目标 ID flag，或显式传 `0`。CLI 在内部把 `0` 翻译成后端要求的 `null`；**不要直接对 Shuttle 后端 API 传 `0`**，它会回 `Directory Node 0 does not exist`。
  - `folder list` 返回某文件夹的直接子项（子文件夹 + 该文件夹下的模板），`folder tree` 返回项目下整棵目录树。
  - `folder delete` 要求文件夹空；删除其中的模板时**务必传 `template delete --project-id <id>`**，CLI 会先把模板从父文件夹解绑、再 DELETE，否则即使 `folder list` 已经空，`folder delete` 仍会返回 `Cannot delete directory as it is not empty`。
  - 区分动作对象：`template move --target-folder-id <id>` 是把单个模板挂到目标文件夹下；`folder move --target-parent-id <id>` 是把整棵子目录挂到新的父级。
  - Shuttle 没有公开的 template-rename 接口（`PUT/POST/PATCH /template/{id}` 全部返回 405，Shuttle UI 也只提供 Move / Save to）。要改名请重新 `template create` 起新名，再 `template delete --project-id` 老的。
- `task result` 从任务详情 `infos.{REGION}.result` 提取列名和数据行。
- `task download` 调用 `GET .../task/{taskId}/download`，把 Excel 或 CSV 写入 `-o/--output`。**`-r/--region`（Aeolus 网关 cn/sg/va）须用户显式指定**，与平时能打开 Shuttle 的 Aeolus 站点一致，**不能**由 task id 或 `--shuttle-region` 推断。`--shuttle-region` 对应 URL 里的 `region=`，**必须与任务详情 `infos` 的 key 一致**（EU 与 US/TTP **不要混用**，拼写以后台为准），**不要与 `-r` 混淆**。大文件用 `--timeout-ms`（默认 180000 ms）。若接口先返回 Shuttle JSON 信封且 `data` 为对象存储 HTTPS 链接，CLI 仅在与 Shuttle API **同 host** 时对跟链请求附带 Aeolus 鉴权，跨域预签名 URL 不会发送 Cookie/token。
- `queue get` 显示项目在各 region 的 YARN 队列资源使用率、可用内存、等待任务数等。

## Notes

- Use `--json` for structured JSON output (global option before subcommand)
- **Region (`-r`) is required** for all Dataset API commands
- Dataset ID can be found in `list-authorized` output
- App ID can be found in `list-authorized` JSON output (`app.id` field)
- Partition fields are marked in `dataset-fields` output
- `dataset-fields`, `dataset-model-info` and `query` only work with `data_set` type, not `dashboard`
- Query Editor commands default to `cn`; pass `-r/--region <region>` to target `sg`, `va`, `mycis`, `hrbimycis`, `mybd`, `sglark`, `usttpusts`, or `usbd`

## References

- `references/aeolus.md`（命令级参考；含 **Query Editor**、`--engine ch`、Regions 与鉴权）
- `references/invocation.md`
