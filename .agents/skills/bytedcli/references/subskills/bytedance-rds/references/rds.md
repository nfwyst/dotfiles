# RDS

## 数据库查询

```bash
# 列出收藏的数据库
bytedcli rds db list --region cn --page 1 --page-size 50

# 搜索数据库
bytedcli rds db search "keyword" --region cn --page 0 --page-size 50

# 列出表
bytedcli rds db table list "dbname" --region cn

# 执行 SQL
bytedcli rds db query "dbname" "SQL" --region cn

# i18n-bd vregion display names are accepted and mapped to RDS regions
bytedcli --site i18n-bd rds db query "demo_db" "SELECT 1" --region US-EE
bytedcli --site i18n-bd rds db query "demo_db" "SELECT 1" --region Asia-SouthEastBD

# BOE vedb / 多云库读取
bytedcli --site boe rds db table list "dbname"
bytedcli --site boe rds db query "dbname" "SHOW TABLES"

# 需要覆盖自动路由时，可显式指定实验性 --mode
bytedcli --site boe rds db table list "dbname" --mode dbw

# EU-Compliance2（ie2）读取：走 eu-ttp 站 + tiktok-eu 网关
bytedcli --site eu-ttp --vregion ie2 rds db query "dbname" "SELECT 1" --region ie2

```

## 数据库详情

```bash
# 获取数据库基本信息
bytedcli rds db get "dbname" --region cn

# 数据库概览（详情 + 拓扑，可选 QPS）
bytedcli rds db overview "dbname" --region cn --qps

# 获取拓扑信息
bytedcli rds db topology "dbname" --region cn

# 获取 QPS
bytedcli rds db qps "dbname" --region cn

# 获取 SLA
bytedcli rds db sla "dbname" --region cn

# 获取表结构
bytedcli rds db table schema "dbname" "table" --region cn

# BOE vedb / 多云库表结构
bytedcli --site boe rds db table schema "dbname" "table"

# 需要覆盖自动路由时，可显式指定实验性 --mode
bytedcli --site boe rds db table schema "dbname" "table" --mode dbw

# 获取参数配置
bytedcli rds db params "dbname" --region cn

```

## 慢查询与诊断

```bash
# 获取慢查询配置
bytedcli rds slow config "dbname" --region cn

# 列出慢查询 SQL
bytedcli rds slow list "dbname" --region cn --instance <ip> --port 3306

# 查询被 kill 的慢 SQL（时间戳为秒级）
bytedcli rds slow kill-sql "dbname" --start-ts <start_epoch> --end-ts <end_epoch> --region cn

# 列出诊断项
bytedcli rds slow diag "dbname" --region cn --page 0 --page-size 20

# 列出告警
bytedcli rds alert list "dbname" --region cn

# 列出监控告警
bytedcli rds alert rules "dbname" --region cn

# 获取运维详情
bytedcli rds ops detail "dbname" --region cn
```

## BPM 工单管理

```bash
# 创建 DDL 工单（推荐：不传 workflow-config-id，让 CLI 按库类型自动选择流程）
# - 字节云 RDS 库：走 target_system=rds 的 DDL 流程
# - 火山/多云库：走 target_system=dbw 的多云 DDL 流程（工单记录可能在 cn BPM 侧）
bytedcli --site boe rds bpm create \
  --ticket-type alter \
  --dbname "demo_db" \
  --sql "ALTER TABLE demo_table ADD COLUMN age INT;" \
  --background "变更原因"

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

# 创建 DML 工单（适用于字节云 RDS / 已确认 workflow 的场景）
# 不要直接把这条示例套用到 BOE 多云 DBW 库；当前 CLI 只会自动选择多云 DDL 流程
bytedcli --site boe rds bpm create \
  --workflow-config-id <dml_workflow_config_id> \
  --dbname "demo_db" \
  --sql "UPDATE users SET status = 1 WHERE id = 100;" \
  --background "数据修复"

# 创建 i18n-bd地区小机架机房 sinf-my DDL 工单 - ALTER
bytedcli --site i18n-bd --vregion sinf-my rds bpm create \
--workflow-config-id 396  \
--dbname "dbname" \
--sql "alter sql"  \
--background "表结构修复"

# 创建 i18n-bd地区小机架机房 sinf-my DML 工单
bytedcli --site i18n-bd --vregion sinf-my rds bpm create \
--workflow-config-id 397  \
--dbname "dbname" \
--sql "update/insert/delete sql"  \
--background "数据修复"

# 查看字节云 RDS 工单详情
bytedcli --site boe rds bpm get <record_id>

# 查看火山/多云 DDL 工单详情（record_id 通常在 cn BPM 侧）
bytedcli --site cn rds bpm get <record_id>

# 列出字节云 RDS 工单
bytedcli --site boe rds bpm list --db-name "demo_db"
bytedcli --site boe rds bpm list --workflow-config-id <workflow_config_id> --status pending

# 列出火山/多云 DDL 工单
bytedcli --site cn rds bpm list --target-system dbw --db-name "demo_db"

# 取消工单
bytedcli --site boe rds bpm cancel <record_id> --reason "取消原因"

# 更新工单 SQL
bytedcli --site boe rds bpm update <record_id> --sql "新的 SQL"

# 获取工作流配置
bytedcli --site boe rds bpm get-workflow-config <workflow_config_id>

# DBW 直连工单：创建 DDL ticket（绕过 BPM wrapper）
bytedcli rds bpm dbw ticket create-ddl \
  --instance-id "vedbm-xxx" \
  --database "demo_db" \
  --sql-file "./ddl.sql" \
  --create-user "61984461" \
  --vregion ChinaSinf-North \
  --request-region-id cn-beijing \
  --title "create demo table"

# DBW 直连工单：查询 / 预检 / 提交 / 自审批 / 取消
bytedcli rds bpm dbw ticket get --ticket-id "2054961441542303744" --instance-id "vedbm-xxx"
bytedcli rds bpm dbw ticket precheck --ticket-id "2054961441542303744" --instance-id "vedbm-xxx"
bytedcli rds bpm dbw ticket submit --ticket-id "2054961441542303744" --instance-id "vedbm-xxx"
bytedcli rds bpm dbw ticket approve --ticket-id "2054961441542303744" --instance-id "vedbm-xxx" --comment "LGTM"
bytedcli rds bpm dbw ticket cancel --ticket-id "2054961441542303744" --instance-id "vedbm-xxx" --reason "不再需要"
```

## Notes

- `workflow-config-id` 与站点强相关，且可能复用/变更；建议优先不传，让 CLI 自动选择并做流程校验（避免误提到非 RDS 的工单）
- 字节云 RDS（target_system=rds）工单可用 `--site boe|cn` 创建与查询
- 火山/多云（target_system=dbw）DDL 工单记录通常在 cn BPM 侧；查询详情优先使用 `--site cn rds bpm get <record_id>`，按库名列表优先使用 `--site cn rds bpm list --target-system dbw --db-name <dbname>`
- BOE 多云库当前只会自动选择 DDL 的 `ddl_sql_multi_cloud` 流程；ChinaSinf-North/huabei2 云上库默认选择小基架 DDL `workflow_config_id=18756`；未确认 workflow 前，不要直接复用 classic RDS 的 DML 示例
- `--site i18n-bd` 不传 `--region` 时默认使用 `mycis`；也支持按 vregion 展示名显式传入并映射为 RDS region：`US-EE -> awsva`、`Asia-SaaS -> jpsaas`、`Singapore-SaaS -> sgsaas1larkidc1`、`Singapore-Common -> sgcomm1`、`Asia-CIS -> mycis`、`Asia-SouthEastBD -> sinf-my`。其中 `Asia-SouthEastBD/sinf-my` 会使用 `BYTECLOUD_HOST_I18N_BD_SINF_BPM + /api/v1/rds-sinf`，其他 i18n-bd RDS 读请求使用 `BYTECLOUD_HOST_I18N_BD + /api/v1/rds`
- `--site i18n-tt` 会自动将 RDS 读命令 region 映射为 `alisg`；如需 `maliva` 等其他区域，请显式传 `--region <value>`
- `--site eu-ttp`（EU TTP / EU-Compliance2）的 RDS 读/查询请求会走 `bc-iedt-gw.tiktok-eu.net` 受限网关（Origin 为 `cloud-eu.tiktok-row.net`）；建议搭配 `--vregion ie2 --region ie2` 使用
- `--site cn` 访问 ChinaSinf-North 区域库的读命令（`rds db|slow|alert|ops`）必须经 `-r/--region` 传入：`-r ChinaSinf-North`（自动归一化为 `sinf`）、`-r sinf`、`-r huabei2` 三个写法等价，都路由到 BCGW vregion `cn-beijing`。同名库可能同时存在于 China-North 与 ChinaSinf-North；不传 `-r` 默认走 `cn`，命中的是 China-North 实例。**注意**：全局 `--vregion` / `--vdc` 对 RDS 读命令不生效；BPM 工单创建用的 `--vregion ChinaSinf-North --vdc huabei2` 是 BPM 单独的链路，不要套到读命令上
- BPM wrapper record 的审批/拒绝请使用 BPM Web UI；`rds bpm dbw ticket approve` 只适用于直连 DBW ticket-id，不适用于 BPM record-id
- DBW 直连工单的 `--ticket-id` 必须保留为字符串，避免 19 位工单号精度丢失
- DDL 工单需要 `--ticket-type`：`alter`（修改表）或 `create`（创建表），DML 工单不需要
- RDS 读命令只会在未显式传 `--region` 时按站点补默认值；显式传入的 `--region` 会按内置 alias 归一化后传给 RDS API
- `rds db table list`、`rds db table schema`、`rds db query` 支持实验性 `--mode auto|legacy|dbw`；默认 `auto`，只在排障或已知特殊库时显式覆盖
- `--site boe` 查询 `vedb` / 多云库时，`db table list`、`db table schema`、`db query` 会自动按库详情里的实际 `volc_region` 路由到 DBW；推荐省略 `--region` 或显式传 `boe`
- 如果显式传 `--site boe --region cn`，CLI 会按 `cn` 原样请求，不会自动改写到 BOE DBW 读链路
- 对 BOE 多云库，`db params`、`alert rules`、`slow config`、`slow list` 当前会直接返回 `RDS_MULTI_CLOUD_UNSUPPORTED`
