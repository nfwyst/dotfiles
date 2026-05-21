---
name: bytedance-rds
description: "Operate RDS via bytedcli: list starred DBs, search databases, list tables, run SQL, view diagnostics, and manage BPM work orders. Use when tasks mention RDS or database operations."
---

# bytedcli RDS

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

- 搜索/列出数据库
- 查看表、执行 SQL
- 数据库诊断和监控
- BPM 工单管理（DDL/DML 变更）

## 前置条件

- 使用通用调用方式：`references/invocation.md` 
- 需要鉴权时先登录：`bytedcli auth login`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

Commands are grouped under `rds db`, `rds slow`, `rds alert`, `rds ops`, and `rds bpm`. Old flat names (e.g. `rds list-starred-db`, `rds get-db-overview`, `rds bpm apply-permission`, `rds bpm update-sql`) still work as hidden aliases.

```bash
# 列出收藏的数据库
bytedcli rds db list --region cn

# 搜索数据库
bytedcli rds db search "keyword" --region cn --page 0 --page-size 50

# 列出表
bytedcli rds db table list "dbname" --region cn

# 执行 SQL
bytedcli rds db query "dbname" "SELECT * FROM users LIMIT 10" --region cn

# i18n-bd vregion display names are accepted and mapped to RDS regions
bytedcli --site i18n-bd rds db query "demo_db" "SELECT 1" --region US-EE
bytedcli --site i18n-bd rds db query "demo_db" "SELECT 1" --region Asia-SouthEastBD

# 数据库概览（详情 + 拓扑，可选 QPS）
bytedcli rds db overview "dbname" --region cn --qps

# BOE vedb / 多云库读取
bytedcli --site boe rds db table list "dbname"
bytedcli --site boe rds db table schema "dbname" "table"
bytedcli --site boe rds db query "dbname" "SHOW TABLES"

# 需要覆盖自动路由时，可显式指定实验性 --mode
bytedcli --site boe rds db table list "dbname" --mode dbw

```

## BPM 工单管理

```bash
# 创建 DDL 工单（推荐：不传 --workflow-config-id，让 CLI 按库类型与站点自动选择流程）
# - 字节云 RDS：走 target_system=rds 的 DDL 流程（BOE/cn 的 workflow_config_id 可能不同）
# - 火山/多云：走 target_system=dbw 的多云 DDL 流程（记录通常在 cn BPM 侧）
bytedcli --site boe rds bpm create \
  --ticket-type alter \
  --dbname "demo_db" \
  --sql "ALTER TABLE demo_table ADD COLUMN age INT;" \
  --background "添加年龄字段"

# 创建 ChinaSinf-North/huabei2 云上 DBW DDL 工单
# 默认走小基架 DDL workflow=18756；若 CLI 无法自动推断实例，请补 --instance-id
bytedcli --site cn --vregion ChinaSinf-North --vdc huabei2 rds bpm create \
  --ticket-type alter \
  --dbname "demo_db" \
  --sql "ALTER TABLE demo_table ADD COLUMN age INT;" \
  --background "变更原因" \
  --instance-id "vedbm-xxx"

# 申请个人库权限工单（支持 maliva 等区域；示例使用 i18n-bd 站点）
bytedcli --site i18n-bd rds bpm permission apply \
  --dbname "demo_db" \
  --region "maliva" \
  --user-list "user1,user2" \
  --background "Apply for dev usage"

# 创建 DDL 工单 - CREATE
bytedcli --site boe rds bpm create \
  --ticket-type create \
  --dbname "demo_db" \
  --sql "CREATE TABLE IF NOT EXISTS demo_table (id INT PRIMARY KEY);" \
  --background "创建新表"

# 查看字节云 RDS 工单详情
bytedcli --site boe rds bpm get 3935899

# 查看火山/多云 DDL 工单详情（record_id 通常在 cn BPM 侧）
bytedcli --site cn rds bpm get 3935899

# 列出字节云 RDS 工单
bytedcli --site boe rds bpm list --db-name "demo_db"

# 列出火山/多云 DDL 工单
bytedcli --site cn rds bpm list --target-system dbw --db-name "demo_db"

# 取消工单
bytedcli --site boe rds bpm cancel 3935899 --reason "不再需要"

# 更新工单 SQL（重试）
bytedcli --site boe rds bpm update 3935899 --sql "新的 SQL"

# DBW 直连工单：创建 / 查询 / 预检 / 提交 / 自审批 / 取消
# 适用于已经拿到 DBW instance_id、create_user、RequestRegionId 的场景；ticket-id 是 19 位 DBW 工单号，按字符串处理
bytedcli rds bpm dbw ticket create-ddl \
  --instance-id "vedbm-xxx" \
  --database "demo_db" \
  --sql-file "./ddl.sql" \
  --create-user "61984461" \
  --vregion ChinaSinf-North \
  --request-region-id cn-beijing

bytedcli rds bpm dbw ticket precheck --ticket-id "2054961441542303744" --instance-id "vedbm-xxx"
bytedcli rds bpm dbw ticket submit --ticket-id "2054961441542303744" --instance-id "vedbm-xxx"
bytedcli rds bpm dbw ticket approve --ticket-id "2054961441542303744" --instance-id "vedbm-xxx"
bytedcli rds bpm dbw ticket cancel --ticket-id "2054961441542303744" --instance-id "vedbm-xxx" --reason "不再需要"
```

## Notes

- 需要结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json rds db list`）
- `workflow-config-id` 与站点强相关，且可能复用/变更；建议优先不传，让 CLI 自动选择并做流程校验（避免误提到非 RDS 的工单）
- 字节云 RDS（target_system=rds）工单可用 `--site boe|cn` 创建与查询
- 火山/多云（target_system=dbw）DDL 工单记录通常在 cn BPM 侧；查询详情优先使用 `--site cn rds bpm get <record_id>`，按库名列表优先使用 `--site cn rds bpm list --target-system dbw --db-name <dbname>`
- BOE 多云库当前只会自动选择 DDL 的 `ddl_sql_multi_cloud` 流程；ChinaSinf-North/huabei2 云上库默认选择小基架 DDL `workflow_config_id=18756`；不要把通用 BOE DML 示例直接套到多云库
- BPM wrapper record 的审批/拒绝请使用 BPM Web UI；`rds bpm dbw ticket approve` 只适用于直连 DBW ticket-id，不适用于 BPM record-id
- DBW 直连工单的 `--ticket-id` 必须保留为字符串，避免 19 位工单号精度丢失
- DDL 工单需要指定 `--ticket-type`：`alter`（修改表）或 `create`（创建表）
- 如果要发起 BES 元信息修改工单，请改用顶层命令：`bytedcli bes metadata update --config <json-object>`
- Flag renames: `--db-name` is a hidden alias; prefer `--dbname` in new scripts
- 多站点操作：`--site <cn|boe|i18n|i18n-bd|i18n-tt|us-ttp|eu-ttp>` 切换 ByteCloud 站点（默认为 cn，或环境变量 `BYTEDCLI_CLOUD_SITE`；`prod` 是 `cn` 的别名）；非法值会直接报错，不会回退到环境变量或默认站点
- RDS 读命令只会在未显式传 `--region` 时按站点补默认值；显式传入的 `--region` 会按内置 alias 归一化后传给 RDS API
- `--site i18n-bd` 不传 `--region` 时默认使用 `mycis`；也支持按 vregion 展示名显式传入并映射为 RDS region：`US-EE -> awsva`、`Asia-SaaS -> jpsaas`、`Singapore-SaaS -> sgsaas1larkidc1`、`Singapore-Common -> sgcomm1`、`Asia-CIS -> mycis`、`Asia-SouthEastBD -> sinf-my`。其中 `Asia-SouthEastBD/sinf-my` 会使用 `BYTECLOUD_HOST_I18N_BD_SINF_BPM + /api/v1/rds-sinf`，其他 i18n-bd RDS 读请求使用 `BYTECLOUD_HOST_I18N_BD + /api/v1/rds`
- `--site i18n-tt` 的 RDS 读命令默认 region 为 `alisg`；如需 `maliva` 等其他区域，请显式传 `--region <value>`
- `--site cn` 访问 ChinaSinf-North 区域库的读命令（`rds db|slow|alert|ops`）必须经 `-r/--region` 传入：`-r ChinaSinf-North`（自动归一化为 `sinf`）、`-r sinf`、`-r huabei2` 三个写法等价，都路由到 BCGW vregion `cn-beijing`。同名库可能同时存在于 China-North 与 ChinaSinf-North；不传 `-r` 默认走 `cn`，命中 China-North。**注意**：全局 `--vregion` / `--vdc` 对 RDS 读命令不生效；BPM 工单创建的 `--vregion ChinaSinf-North --vdc huabei2` 是 BPM 单独的链路，不要套到读命令上
- `rds db table list`、`rds db table schema`、`rds db query` 支持实验性 `--mode auto|legacy|dbw`；默认 `auto`，只在排障或已知特殊库时显式覆盖
- `--site boe` 查询 `vedb` / 多云库时，`db table list`、`db table schema`、`db query` 会自动按库详情里的实际 `volc_region` 路由到 DBW；推荐省略 `--region` 或显式传 `boe`
- 如果显式传 `--site boe --region cn`，CLI 会按 `cn` 原样请求，不会自动改写到 BOE DBW 读链路
- 对 BOE 多云库，`db params`、`alert rules`、`slow config`、`slow list` 当前会直接返回 `RDS_MULTI_CLOUD_UNSUPPORTED`

## References

- `references/rds.md`
