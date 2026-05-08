# ByteDoc

ByteDoc 数据库搜索、列表、详情、关注、集合、文档读写、数据查询与慢查询分析统一收敛在 `bytedoc db <action>`。

## 常见命令

```bash
# 搜索数据库
bytedcli bytedoc db search --keyword "demo_orders"
bytedcli bytedoc db search --keyword "bytedoc.demo_catalog" --backend cloud-native
bytedcli bytedoc db search --keyword "bytedoc.demo_catalog" --backend volc

# 查看我关注的库 / 数据库详情
bytedcli --json bytedoc db list
bytedcli --json bytedoc db list --all --deploy-mode cloud-native
bytedcli --json bytedoc db get --service "demo_orders" --deploy-mode classic

# 集合与慢查询
bytedcli --json bytedoc db collections --service "demo_orders"
bytedcli --json bytedoc db collections --db-name demo_catalog
bytedcli --json bytedoc db collection create --service "example.bytedoc.demo_catalog" --collection "demo_items"
bytedcli --json bytedoc db collection rename --service "example.bytedoc.demo_catalog" --collection "demo_items" --to "demo_items_next"
bytedcli --json bytedoc db collection drop --service "example.bytedoc.demo_catalog" --collection "demo_items_next"
bytedcli --json bytedoc db slow-query overview --service "demo_orders" --deploy-mode classic --millis 100
bytedcli --json bytedoc db slow-query metrics --service "demo_orders" --deploy-mode classic --interval 5m

# 数据查询（默认自动识别 classic / cloud-native / volc；同名歧义时优先用 --backend）
bytedcli --json bytedoc db query --service "demo_orders" --collection "demo_records" --query 'find().limit(10)'
bytedcli --json bytedoc db query --service "demo_orders" --collection "demo_records" --query-file ./query.mongo
bytedcli --json bytedoc db query --db-name demo_catalog --collection "demo_items" --query 'find().limit(10)'
bytedcli --json bytedoc db query --db-name demo_catalog --backend cloud-native --collection "demo_items" --query 'find().limit(10)'
bytedcli --json bytedoc db query --service "example.bytedoc.demo_catalog" --backend volc --collection "demo_items" --query 'find().limit(10)'

# 文档 CRUD（cloud-native / Volc Mongo）
bytedcli --json bytedoc db document query --service "example.bytedoc.demo_catalog" --collection "demo_items" --filter-json '{"tenant":"demo"}' --limit 10
bytedcli --json bytedoc db document insert --service "example.bytedoc.demo_catalog" --collection "demo_items" --doc-json '{"tenant":"demo","value":1}'
bytedcli --json bytedoc db document update --service "example.bytedoc.demo_catalog" --collection "demo_items" --filter-json '{"tenant":"demo"}' --update-json '{"$set":{"value":2}}'
bytedcli --json bytedoc db document delete --service "example.bytedoc.demo_catalog" --collection "demo_items" --filter-json '{"tenant":"demo"}'
```

## 说明

### 后端分类

- `backend=classic`：传统 ByteDoc，Cloud Service Search 原始 `mode=classic`；查询走 classic `web_query`，列表、关注、详情、慢查询走 classic ByteDoc API。
- `backend=cloud-native`：cloud-native ByteDoc，Cloud Service Search 原始 `mode=cloud-native`；查询走 DMS subscribe / evaluate，慢查询走 cloud-native slowquery API。
- `backend=volc`：DBW / Volc Mongo，Cloud Service Search 原始 `mode=volc`；实例信息来自 `instance_id`、`instance_type`、`region`、`vregion`，集合、查询和文档/集合写操作走 DBW Mongo 执行链路。
- `mode` 是 Cloud Service Search 返回的原始字段；`backend` 是 CLI 对外的严格三态选择器；`deployMode` 是 legacy 平台路由字段，仅有 `classic|cloud-native` 两态。

### 命令链路

- `bytedoc db search` 以 ByteDoc Cloud Service Search 为准，默认返回 `backend=classic|cloud-native|volc` 和原始 `mode`；`--backend` 是严格三态过滤项，`--deploy-mode` 仅作为 legacy 两态兼容过滤项。
- `bytedoc db list` 默认展示关注列表；未显式传 `--deploy-mode` 时会合并 classic 和 cloud-native 的关注列表。
- `bytedoc db list --all` 展示全量数据库；未显式传 `--deploy-mode` 时默认查 `classic`。
- `bytedoc db list` / `bytedoc db follow` / `bytedoc db slow-query *` 仍只有 classic / cloud-native 平台接口，没有独立 Volc 后端；Volc 页面上的日志、备份、参数等能力属于 DBW / Volc 详情面。
- `db get` 可以传 `--db-name` 或 `--service`；classic / cloud-native 返回平台详情，Volc Mongo 只在解析到 DBW 元信息时返回 Cloud Service / DBW summary，且不返回 classic usage。
- `bytedoc db collections` 不再需要 `--deploy-mode`；CLI 会自动识别 classic、cloud-native 或 Volc Mongo 数据库，也可用 `--backend classic|cloud-native|volc` 消歧。
- `bytedoc db query` 默认不需要 `--deploy-mode`；CLI 会自动识别 classic、cloud-native 或 Volc Mongo 数据库，并在对应场景下自动选择查询链路。同一个 `service` / `dbName` 存在多个 backend 时，显式传 `--backend classic|cloud-native|volc` 消歧；`--deploy-mode` 只能区分 legacy `classic|cloud-native` 两态。
- `bytedoc db collection <create|drop|rename>` 与 `bytedoc db document <query|insert|update|delete>` 面向 cloud-native / Volc Mongo，CLI 会根据 ByteDoc 元信息自动使用数据库工作台后端访问。
- `db slow-query subscribers` / `metrics` / `index-recommend` 在 classic 和 cloud-native 下都会统一走 slowquery 服务；只给 classic `--db-name` 时，CLI 会先解析 service。
- `db slow-query detail` 在 classic 下既支持直接传 24 位 ObjectId，也支持传 `overview` 里的 fingerprint id；CLI 会自动尝试把 fingerprint 展开成 `_ids` 再查询 detail。
- `bytedoc db query` 的输入仍是 `--collection` 和 Mongo shell 风格 `--query` / `--query-file`；cloud-native / Volc Mongo 查询会自动改写成 `db.<collection>.<query>` 后再发给对应后端。
- `bytedoc db query` 会把 classic 的 Mongo shell 原始文本尽量归一化成和 cloud-native(DMS) 接近的结构化结果，统一输出 `type`、`printable.documents` 和 `source.namespace`。
