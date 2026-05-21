---
name: bytedance-manta
description: "Operate Manta (DataLeap) data profiling, table monitor query/result/trial-run/create/update, and two-table comparison via bytedcli: list namespaces and YARN queues, list/get/run/create/update table monitor rules, query monitor alarm results, create profiling rules, list/get profiling jobs, create comparison jobs, query comparison job summaries, authenticate with DataLeap Manta, and manage data quality tasks. Use when tasks mention Manta, DataLeap data profiling, monitor rules, monitor alarm results, monitor rule trial runs, monitor rule creation/updates, data comparison, comparison result summaries, data quality checks, profiling results, or profiling/comparison rules."
---

# bytedcli Manta

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

- DataLeap Manta 数据探查（Profiling）任务管理
- 查询 Manta namespace（`namespaces`）、表监控规则（`monitor list/get`）、试跑监控规则（`monitor run`）、监控报警结果（`monitor result list`）、创建监控规则（`monitor create`）、更新监控规则（`monitor update`）和数据探查任务（`profile job list/result`）
- 创建数据探查规则（`profile rule create`）
- 两表数据对比（`comparison job create`）
- 查询两表对比结果（`comparison job get`，支持 `--view summary|overview`）
- 查询指定字段的 diff SQL（`comparison job diff-sql`）
- SQL 数据比对，自动处理 map/array 字段（`comparison sql create`）
- 通过浏览器登录 DataLeap Manta（`auth login`）
- 数据质量检查与分析

## Agent Guidance

**鉴权前置（必须）：** Manta 只接受 DataLeap session cookie 鉴权，仅有 JWT 不够。执行任何 Manta 命令前，必须先完成以下步骤：

1. 检查 `puppeteer-core` 是否已安装：`npm ls -g puppeteer-core`
2. 若未安装，先执行 `npm install -g puppeteer-core`
3. 为目标 region 执行浏览器登录：`bytedcli manta auth login --region <region>`
4. 登录完成后再执行后续 Manta 命令
5. `mycis` 属于 built-in region，站点映射到 `i18n-bd`，不要再按 `i18n-tt` 口径引导登录

**yarn 队列（自动探测）：** `--yarn-cluster` 和 `--yarn-queue` 是创建探查任务的必填参数。不同区域的队列完全不同，**禁止猜测或编造队列名**。正确做法：
1. 先通过 `bytedcli manta yarn-queues --region <region>` 列出用户有权限的队列
2. 从返回结果中选取合适的队列（优先选 load_rate 较低的）
3. 将队列的 `yarn_cluster` 和 `yarn_queue` 字段分别传给 `--yarn-cluster` 和 `--yarn-queue`

**标准操作流程（数据探查）：**
1. 确保 puppeteer-core 已安装
2. `bytedcli manta auth login --region <region>` — 浏览器登录
3. `bytedcli manta yarn-queues --region <region>` — 探测可用队列
4. `bytedcli manta profile rule create --region <region> --yarn-cluster <cluster> --yarn-queue <queue> ...` — 创建探查任务

**标准操作流程（两表对比）：**
1. 确保 puppeteer-core 已安装
2. `bytedcli manta auth login --region <region>` — 浏览器登录
3. `bytedcli manta comparison job create --region <region> --db-name-old <db> --tb-name-old <tb> --partition-old <p> --db-name-new <db> --tb-name-new <tb> --partition-new <p> --primary-keys "<keys>"` — 创建对比任务
4. `bytedcli manta comparison job get --region <region> --instance-id <id> [--view summary|overview]` — 查询对比任务概要或 overview 结果

**两表对比结果命名约定：**
- 对比结果查询统一收敛为资源化读命令：概要或 overview 使用 `bytedcli manta comparison job get --region <region> --instance-id <id> [--view summary|overview]`
- 指定字段的差异 SQL 使用 `bytedcli manta comparison job diff-sql --region <region> --instance-id <id> --old-column <name> --new-column <name>`
- 对外命令不要直接暴露后端 endpoint 名字，如 `result-info`、`result-overview`、`diff/sql`；这些路径只作为 API 层实现细节保留

**标准操作流程（SQL 比对 — 适合含 map/array 字段的表）：**
1. 确保 puppeteer-core 已安装
2. `bytedcli manta auth login --region <region>` — 浏览器登录
3. 如果用户已明确 `--map-keys` / `--json-keys`，直接跳到步骤 6
4. 若用户不清楚哪些字段是复杂结构体（map/array），先探查表 schema：
   - `bytedcli --json hive detail <db> <table> --region <region>` — 从返回的 `fields[].dataType` 中识别 `map<>`、`array<>` 类型字段
   - 将找到的复杂字段及其类型告知用户
5. 若存在 `map<>` 字段，需要了解 map 内部有哪些 key 才能展开对比。此时**询问用户是否要执行 adhoc 查询来发现 map key**：
   - 若用户同意，**要求用户提供 Dorado 临时查询 task-id 或 DataLeap 任务链接**（格式如 `https://dataleap-<region>.tiktok-row.net/dorado/development/query/<task-id>?project=...`，从 URL 路径中提取 `<task-id>`）
   - 使用 `bytedcli dorado adhoc exec` 查询每个 map 字段的 key 分布，例如：
     ```
     bytedcli --json dorado adhoc exec \
       "SELECT k, COUNT(1) as cnt FROM <db>.<table> LATERAL VIEW explode(<map_col>) t AS k, v WHERE <filter> GROUP BY k ORDER BY k" \
       --task-id <task-id> --region <region>
     ```
   - 若源表和目标表的过滤条件不同，分别查询两侧的 key，取并集
   - 将发现的 key 列表组装为 `--map-keys "col=key1,key2,..."`
   - 若用户拒绝查询，可以不指定 `--map-keys`，map 列将作为原始字符串整体对比
6. `bytedcli manta comparison sql create --region <region> --source-table <db.table> --target-table <db.table> --source-filter "<condition>" --target-filter "<condition>" --join-keys "<keys>" --map-keys "<spec>" --dry-run` — 先 `--dry-run` 预览 SQL
7. 确认 SQL 无误后，去掉 `--dry-run` 正式提交

**缺参时优先追问：**
- `--region`：用户要操作哪个区域
- 探查：`--db-name` + `--tb-name` + `--partitions`
- 对比：`--db-name-old/new` + `--tb-name-old/new` + `--partition-old/new` + `--primary-keys`（主键必须由用户指定或确认，禁止猜测）
- SQL 比对：`--source-table` + `--target-table` + `--join-keys`（关联键必须由用户指定或确认）

**监控规则查询/创建/更新经验：**
- 查询具体表的监控规则时，如果已知项目归属，优先显式传 `--project-id`
- 在 `mycis` 等区域，仅传 `--table-name-query` 或不带项目过滤时，`manta monitor list` 后端可能返回 `50005`
- 推荐命令：`bytedcli manta monitor list --region <region> --project-id <id> --table-name-query <db.table>`
- `manta monitor list` 与 `manta monitor result list` 默认都应携带 `--project-id`；CLI 会在缺失时直接报参数错误
- 查询监控报警结果使用 `bytedcli manta monitor result list`；`--mode template` 查询 Hive 模板规则结果，`--mode custom` 查询自定义 SQL 规则结果，默认 `--mode all` 同时查询两类结果
- 常用过滤：`--business-date-start <yyyymmdd>` + `--business-date-end <yyyymmdd>` 组成日期范围（必须成对出现）；`--rule-id <id>` 按业务规则 ID 搜索，`--mine` 只看我的结果，`--only-alarm` 只看已报警结果，`--project-id <id>` 可重复指定项目
- 查询某条规则详情：`bytedcli manta monitor get --region cn --rule-id <id>`（`--mode` 可选，默认 `custom`）
- 试跑规则使用 `bytedcli manta monitor run --region cn --rule-id <id> --date "YYYY-MM-DD HH:mm:ss"`；`--rule-id` 可重复传多个，试跑结果用 `manta monitor result list --business-date-start ... --business-date-end ... --rule-id ... --project-id ...` 查询
- 创建规则统一使用 `bytedcli manta monitor create --mode <custom|template> ...`
  - `--mode custom` → `POST /monitor/batch_create_monitor`
  - `--mode template` → `POST /monitor/batch_create_monitor_with_object`
  - 不传 `--body-file` 时，至少需要 `--project-id`、`--monitor-name`、`--monitor-type`；`custom` 模式还需要 `--rule-sql`
  - 传 `--body-file` 时，请求体完整直传并覆盖结构化参数
- 更新规则时，`--body-file` 为完整请求体直传；不传 `--body-file` 时，CLI 会先读取当前规则详情并合并本次传入字段后提交
- 关闭监控规则时，使用 Manta 后端枚举值 `DISABLE`；CLI 通过监控规则启停接口提交状态变更

**`custom + --body-file` 已验证可用结构（推荐）：**

```bash
bytedcli manta monitor create --region cn --mode custom --body-file skills/bytedance-manta/references/demo-manta-custom-monitor-sources.json
```

- 示例请求体文件：`skills/bytedance-manta/references/demo-manta-custom-monitor-sources.json`
- 自定义 SQL 规则在 `--body-file` 模式下优先使用 `monitor_sources[].monitor_conf_list[]` 结构，比扁平字段更稳妥。

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- **必须安装 `puppeteer-core`**：`npm install -g puppeteer-core`
- **必须先登录**：`bytedcli manta auth login --region <region>`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

Commands are grouped under `manta auth`, `manta namespaces`, `manta yarn-queues`, `manta monitor`, `manta profile`, and `manta comparison` (including `comparison job` and `comparison sql`).

```bash
# 步骤 1：确保 puppeteer-core 已安装
npm install -g puppeteer-core

# 步骤 2：登录目标区域
bytedcli manta auth login --region va

# 步骤 3：查看可用的 YARN 队列
bytedcli manta yarn-queues --region va

# 查看 namespace 或历史数据探查任务
bytedcli manta namespaces --region va
bytedcli manta monitor list --region va --table-name-query demo_db.demo_table --project-id 1234567
bytedcli manta monitor result list --region cn --mode all --business-date-start 20260518 --business-date-end 20260519 --rule-id 123456 --mine --only-alarm --project-id 1234567 --page-size 50
bytedcli manta monitor get --region cn --rule-id 1552347
bytedcli manta monitor run --region cn --rule-id 1552347 --date "2026-05-19 00:00:00"
bytedcli manta monitor create --region cn --mode custom --project-id 1085 --monitor-name demo_rule --monitor-type Custom_SQL --rule-sql "select 1"
bytedcli manta monitor create --region cn --mode template --project-id 1085 --monitor-name demo_template_rule --monitor-type Table_Lines
bytedcli manta monitor update --region cn --rule-id 1552347 --description sample-update
bytedcli manta profile job list --region va --table-name-query demo_table --limit 20
bytedcli manta profile job result --region va --instance-id 123456

# 步骤 4a：创建数据探查规则（省略 --columns 会自动探查全部字段，YARN 队列自动选择）
bytedcli manta profile rule create --region va --db-name demo_db --tb-name demo_table --partitions date=20260401

# 步骤 4a（多级分区）：用 / 分隔多级分区
bytedcli manta profile rule create --region va --db-name demo_db --tb-name demo_table --partitions date=20260401/asset_type=sdk/metrics_tag=basic_info

# 步骤 4b：创建两表对比任务（主键和对比列必须显式指定或由用户确认）
bytedcli manta comparison job create --region va --db-name-old demo_db --tb-name-old demo_table --partition-old date=20260401 --db-name-new demo_db --tb-name-new demo_table --partition-new date=20260402 --primary-keys "id"

# 查看对比任务概要
bytedcli manta comparison job get --region va --instance-id 123456

# 查看对比任务 overview
bytedcli manta comparison job get --region va --instance-id 123456 --view overview

# 查看指定字段的 diff SQL
bytedcli manta comparison job diff-sql --region va --instance-id 123456 --old-column obj_type --new-column obj_type

# 步骤 4b（多级分区）：用 / 分隔多级分区
bytedcli manta comparison job create --region va --db-name-old demo_db --tb-name-old demo_table --partition-old "date=20260401/asset_type=sdk/metrics_tag=v1" --db-name-new demo_db --tb-name-new demo_table --partition-new "date=20260401/asset_type=sdk/metrics_tag=v2" --primary-keys "id"
```

更多示例：

```bash
# 登录其他区域
bytedcli manta auth login --region cn
bytedcli manta auth login --region sg
bytedcli manta auth login --region eu

# 列出 SG 区域的队列
bytedcli manta yarn-queues --region sg

# 通过 JSON 文件创建探查（可跳过显式参数）
bytedcli manta profile rule create --body-file ./demo-profile-rule.json

# 两表对比：指定主键和对比列
bytedcli manta comparison job create --region sg --db-name-old demo_db --tb-name-old demo_table --partition-old date=20260402 --db-name-new demo_db --tb-name-new demo_table --partition-new date=20260403 --primary-keys "upstream_id;downstream_id" --comparison-columns "col_a;col_b;col_c"

# 两表对比：通过 JSON 文件
bytedcli manta comparison job create --body-file ./demo-comparison.json

# SQL 比对：自动处理 map/array 字段
bytedcli manta comparison sql create --region cn --source-table demo_db.demo_table --target-table demo_db.demo_table --source-filter "date='20260405' and type='A'" --target-filter "date='20260405' and type='B'" --join-keys user_id

# SQL 比对：展开 map 字段并预览 SQL
bytedcli manta comparison sql create --region cn --source-table demo_db.demo_table --target-table demo_db.demo_table --source-filter "date='20260405'" --target-filter "date='20260404'" --join-keys user_id --map-keys "metrics=cpu,mem" --dry-run
```

## Supported Regions

| Region | Description | Endpoint |
|--------|-------------|----------|
| `cn` | China (default) | data.bytedance.net |
| `sg` | Singapore | dataleap-sg.tiktok-row.net |
| `va` | US East (Virginia) | dataleap-va.tiktok-row.net |
| `eu` | EU | dataleap.tiktok-eu.net |
| `mycis` | MYCIS | dataleap-mycis.byteintl.net |

## Authentication

Manta **只接受 DataLeap session cookie** 鉴权，仅有 SSO JWT 不够。必须通过浏览器登录获取 cookie：

```bash
# 1. 安装 puppeteer-core（仅首次）
npm install -g puppeteer-core

# 2. 登录目标区域（会打开浏览器，完成登录后自动保存 cookie）
bytedcli manta auth login --region <region>
```

Region-to-SSO 映射：
- `cn` → `prod` 站点（ByteDance SSO）
- `sg`、`va`、`eu` → `i18n-tt` 站点（TikTok SSO，需单独登录）
- `mycis` → `i18n-bd` 站点（ByteDance SSO）

## Notes

- 需要结构化输出加 `--json`（全局参数，放在 `manta` 前面）
- `monitor list` 通过 `POST /monitor/object/find_monitors` 查询规则；文本模式会按“表/分区/规则/状态”展开 `parts[].monitors[]`
- `monitor run` 通过 `POST /monitor/dry_run` 试跑规则，请求体包含 `monitor_id_list` 和 `date`；`--date` 使用 `YYYY-MM-DD HH:mm:ss`
- `monitor result list` 查询监控报警结果；`--mode template` 走 Hive 模板结果接口，`--mode custom` 走自定义 SQL 结果接口，默认 `all` 合并两类结果；文本模式输出扁平表格，`--json` 保留原始响应
- `monitor create` 统一走单命令 + `--mode`：`custom` 调 `POST /monitor/batch_create_monitor`，`template` 调 `POST /monitor/batch_create_monitor_with_object`；传 `--body-file` 时请求体完整直传
- `--columns` 支持简写格式 `name:type,...` 和完整 JSON 数组两种形式；省略时自动获取表 schema 并探查全部字段
- `--partitions` 可重复传入多个分区；多级分区用 `/` 分隔，例如 `date=20260401/asset_type=sdk/metrics_tag=basic_info`
- `--partition-old` / `--partition-new` 同样支持多级分区格式，例如 `date=20260401/asset_type=sdk/metrics_tag=v1`
- `profile rule create` 在创建成功后会输出 report URL，可直接打开查看 Profiling 结果
- YARN 队列：探查和对比都会自动从用户可用队列中选取负载最低的，无需手动指定；也可通过 `--yarn-cluster`/`--yarn-queue`（探查）或 `--yarn-queue region/idc/cluster/queue`（对比）显式指定
- `comparison job create` 在创建成功后会输出对比 report URL
- `comparison job get` 默认走 `GET /comparison/result-info`；传 `--view overview` 时走 `GET /comparison/result-overview`；两种结果都会附带 report URL
- `comparison job diff-sql` 走 `GET /comparison/diff/sql`，按 `instance_id + old_column + new_column` 获取指定字段的 diff SQL
- 对比任务的 `--primary-keys` 控制 JOIN 匹配行，`--comparison-columns` 控制对比哪些字段；两者用 `;` 分隔多项
- 对比任务中主键必须由用户指定或确认，禁止猜测；未指定时 CLI 会自动推断并发出警告
- `comparison sql create` 生成自定义 SELECT SQL 并提交到 Manta SQL 比对端点，适合含 `map<>`/`array<>` 复杂类型字段的表
- `--map-keys` 格式为 `col=key1,key2;col2=key3,key4`，指定 map 字段需要展开的 key；未指定时保留原始列
- `--dry-run` 仅生成 SQL 并输出列信息，不提交任务

## References

- `references/manta.md`
