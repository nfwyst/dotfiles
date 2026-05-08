---
name: bytedance-bytehouse
description: "Run SQL on ByteHouse clusters through bytedcli: search ByteHouse clusters and execute SQL on the selected ByteHouse cluster by cluster id or cluster name. Use when tasks mention ByteHouse, ClickHouse query editor, ByteHouse cluster search, running SQL in ByteHouse, dry-run SQL, or the ByteHouse query console."
---

# bytedcli ByteHouse

## 如何调用 bytedcli

先选择一种调用方式。下面所有示例默认直接写 `bytedcli`。

```bash
# 方式 1：直接用 npx 运行最新版
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]

# 方式 2：先全局安装，再直接调用 bytedcli
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli <command> [options]
```

## When to use

- 搜索 ByteHouse / ClickHouse 查询控制台里的集群。
- 在指定 ByteHouse 集群上执行 SQL，并需要 JSON 结果供 agent 或脚本消费。
- 需要通过 `--dry-run` 先验证 SQL。
- SQL 来自用户输入或本地 `.sql` 文件。

如果任务是 DataLeap CoralNG 建表、改字段、改 TTL 或按库名查 DataLeap 记录里的 ClickHouse 元数据，请使用 `bytedance-clickhouse`。
如果任务是搜索 DataLeap 资产、schema 或 lineage，请使用 `bytedance-hive`。

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要先登录：`bytedcli auth login`
- 若本地没有可复用的 ByteHouse 查询控制台登录态，先执行：`bytedcli auth login --session`

## Quick start

```bash
# 搜索集群
bytedcli bytehouse cluster search --keyword demo --limit 5
bytedcli --json bytehouse cluster search --region cn --product demo-product

# 按 cluster id 在 ByteHouse 集群上执行 SQL
bytedcli --json bytehouse query run --cluster-id 1001 --sql "SELECT 1" --rows 20

# 按 cluster name 自动解析 id，再在 ByteHouse 集群上执行文件里的 SQL
bytedcli bytehouse query run --cluster-name demo_cluster --file ./query.sql

# dry-run SQL
bytedcli bytehouse query run --cluster-id 1001 --sql "SELECT count(*) FROM demo_db.sample_table" --dry-run
```

## Commands

### `bytehouse cluster search`

```bash
bytedcli bytehouse cluster search [--keyword <keyword>] [--region <region>] [--dc <dc>] [--product <product>] [--limit <n>]
```

常用参数：

- `--keyword <keyword>`：在集群名、tag、product、owner、PSM、region、dc、description、status 中搜索。
- `--region <region>`：按 region 过滤。
- `--dc <dc>`：按机房过滤。
- `--product <product>`：按产品过滤。
- `--limit <n>`：最多返回多少条，默认 20。
- `--json`：结构化输出。

### `bytehouse query run`

```bash
bytedcli bytehouse query run (--cluster-id <id> | --cluster-name <name>) (--sql <sql> | --file <path>) [--dry-run] [--rows <n>]
```

常用参数：

- `--cluster-id <id>`：ByteHouse 集群 id，推荐脚本场景优先使用。
- `--cluster-name <name>`：集群名；CLI 会先搜索并解析出唯一匹配的 id。
- `--sql <sql>`：直接传 SQL。
- `--file <path>`：从本地文件读取 SQL。
- `--dry-run`：以 dry-run 模式提交。
- `--rows <n>`：限制输出行数；JSON 下 `row_count` 仍保留原始行数。
- `--json`：结构化输出，包含 `columns`、`rows`、`row_count`、`time_spend_ms`。

## Notes

- `--cluster-id` 与 `--cluster-name` 必须二选一。
- `--sql` 与 `--file` 必须二选一。
- `query run` 会把 SQL 提交到选中的 ByteHouse 集群执行；查询控制台只用于复用集群列表、鉴权和执行入口。
- 若 `--cluster-name` 找不到或不唯一，先运行 `bytehouse cluster search --keyword <name>` 查看候选，再改用 `--cluster-id`。
- 文本模式会输出紧凑表格；agent/脚本默认用 `--json`。

## References

- `references/invocation.md`
- `references/troubleshooting.md`
