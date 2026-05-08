---
name: bytedance-hive
description: "Search, explore, create, and modify Hive/Clickhouse/Doris data assets via bytedcli: search databases and tables, get detailed schema information with columns, locate producer Dorado task IDs, view entity lineage, create new Hive tables or Doris tables through `hive create`, and modify table field definitions. Use when tasks mention Hive, DataLeap, data catalog, table schema, column metadata, Dorado producer tasks, data lineage, creating tables, or modifying table fields."
---

# bytedcli Hive (DataLeap Data Catalog)

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

- Search for Hive databases and tables in DataLeap
- Get detailed table/database information including schema and columns
- Locate upstream producer Dorado task IDs from a Hive table or entity
- Check partition row counts and top partitions for Hive tables
- View data lineage relationships
- Explore Clickhouse and Doris data assets
- Create new Hive tables with fields, partition keys, TTL, and storage settings
- Create Doris tables through `hive create --type DorisTable` using raw DDL plus namespace metadata
- Modify table field definitions (column names, types, comments, security labels)

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 在 ByteDance 生产网环境下调用 sg region 前，`export BYTEDCLI_NETWORK_PROFILE=prod`。

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Supported Asset Types

| Type | Description |
|------|-------------|
| `HiveDB` | Hive databases |
| `HiveTable` | Hive tables |
| `ClickhouseDB` | Clickhouse databases |
| `ClickhouseTable` | Clickhouse tables |
| `DorisTable` | Doris tables |
| `DataTopics` | Data topics |

## Supported Regions

| Region | Description | Endpoint |
|--------|-------------|----------|
| `cn` | China (default) | data.bytedance.net |
| `sg` | Singapore ROW | dataleap-sg.tiktok-row.net |
| `gcp` / `eu` | EU Compliance2 | dataleap-gp-ttp-eu.tiktok-eu.net |
| `va` | us-east, maliva | dataleap-va.tiktok-row.net |
| `mycis` | MYCIS | dataleap-mycis.example.net |
| `mybd` | MYBD | dataleap-mybd.example.net |

## Quick start

```bash
# Search for Hive databases
bytedcli hive search --query "my_database" --type HiveDB --region cn

# Search for Hive tables
bytedcli hive search --query "user" --type HiveTable --region gcp

# Get database details
bytedcli hive detail my_database --region cn

# Get table details with full schema and producer Dorado task IDs
bytedcli hive detail my_database my_table --region gcp

# Get entity details by GUID (from search results)
bytedcli hive get <guid> --region cn

# Get partition row counts for a table (shows total rows and top 20 partitions)
bytedcli hive rows my_database my_table --region cn

# View data lineage
bytedcli hive lineage <guid> --region cn --depth 3

# Modify table fields (columns) by GUID
bytedcli hive modify field --guid <guid> --fields '[{"typeName":"HiveColumn","name":"col1","dataType":"string","comment":"description"}]' --region cn

# Create a new Hive table (fields + partition keys explicit)
bytedcli hive create \
  --database demo_db \
  --table demo_table \
  --ttl 365 \
  --fields '[{"name":"psm","dataType":"string","comment":"service name"},{"name":"qps","dataType":"double","comment":"qps"}]' \
  --partition-keys '[{"name":"date","dataType":"string","comment":"date"}]' \
  --region cn

# Create a new Hive table from DDL (fields and partition keys parsed automatically)
bytedcli hive create \
  --database demo_db \
  --table demo_table \
  --ttl 365 \
  --ddl "CREATE TABLE IF NOT EXISTS \`demo_db\`.\`demo_table\` (\`psm\` string COMMENT 'psm') PARTITIONED BY (\`date\` string COMMENT 'date')" \
  --region cn

# Create a new Doris table from raw DDL
bytedcli hive create \
  --database demo_db \
  --table demo_doris_table \
  --type DorisTable \
  --namespace doris_demo_cn \
  --alias "demo table" \
  --ddl "$(cat /tmp/demo_doris.sql)" \
  --region cn
```

## Notes

- Use `--json` for structured JSON output
- Default region is `cn` if not specified
- Default asset type for search is `HiveDB`
- The `detail` and `get` commands show full schema including column names, types, comments, and producer Dorado task IDs when upstream lineage contains `DoradoTask`
- The `rows` command shows the total row count and the top 20 partitions by row count
- Lineage shows upstream and downstream data dependencies
- The `modify field` command updates field definitions by GUID; use `--fields` to pass the full column array as JSON. Get the current fields first via `hive get <guid>` or `hive detail`, then submit the updated array.
- The `create` command requires `--database` and `--table`; `--ttl` is required for `HiveTable` but not for `DorisTable`.
- For `HiveTable`, fields/partition-keys can be provided via `--fields`/`--partition-keys` (JSON arrays) or derived automatically from `--ddl`. When `--ddl` is provided, `--fields` and `--partition-keys` become optional (parsed from DDL), but can still be passed to override.
- For `DorisTable`, use `--type DorisTable --namespace <name> --ddl <sql>`. Doris creation submits the raw DDL directly and does not use Hive field parsing or the Hive explain endpoint.
- When passing Doris DDL that contains backticks or multiple lines, prefer loading it from a file, e.g. `--ddl "$(cat /tmp/demo_doris.sql)"`, to avoid shell command substitution corrupting the SQL.
- Owner defaults to the current SSO user.
- Before submitting a `HiveTable`, `create` performs two layers of validation: (1) local checks — non-empty fields, no duplicate names within fields/partition-keys, and no overlapping names between fields and partition-keys; (2) server-side DDL validation via `POST /bridge/hive/explain` — catches SQL syntax and semantic errors (e.g. duplicate column names) before the actual create request is sent.

## References

- `references/hive.md`
- `references/invocation.md`
