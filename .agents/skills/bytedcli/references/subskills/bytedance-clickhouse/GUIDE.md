---
name: bytedance-clickhouse
description: "Create or edit ClickHouse tables in DataLeap CoralNG via bytedcli, and look up ClickHouse database metadata (cluster / virtual warehouse / owners / env) by database name: structured field + engine parameter input (HaMergeTree / HaUniqueMergeTree / CnchMergeTree), shard/sample/unique/version keys, TTL, partition keys, security level, authority admin and business contacts; modify existing tables' columns / partition keys / primary key by GUID; modify existing tables' TTL (lifecycle in days) by GUID; auto-resolves --cluster-name from --database. Use when tasks mention creating or editing a ClickHouse table, ClickHouse DDL, CoralNG ClickHouse, modifying ClickHouse columns, changing a ClickHouse table's TTL, looking up a ClickHouse cluster by DB name, or ByteHouse data-store creation."
---

# bytedcli ClickHouse (DataLeap CoralNG)

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

- 在 DataLeap 上创建一张 ClickHouse 表（CnchMergeTree / HaMergeTree / HaUniqueMergeTree 等 Engine）。
- 修改已有 ClickHouse 表的列 / 分区键 / 主键（`clickhouse field update`，按 GUID 定位，整表替换列定义）。
- 修改已有 ClickHouse 表的表级属性（`clickhouse attr update`，按 GUID 定位，支持 TTL / 描述 / owner / 业务联系人 / 权限管理员 / 安全等级 / 核心资产标记；未传的 option 保留原值）。
- 需要结构化地传字段、分区键、引擎特定属性（shard/sample/unique/version key、分区级唯一键、disk-based 唯一键索引等）。
- 创建时希望指定 TTL、安全等级、authority admin、业务联系人、应用说明等元数据。
- 按 database 名反查 ClickHouse 库的集群（`cluster`）、虚拟仓（`virtualWarehouse`）、owners / managers / env / createTime 等元信息。

对于 ClickHouse 资产的**搜索 / 详情 / 血缘**，继续使用 `bytedance-hive` skill；本 skill 负责建表、改表、改表级属性与库元信息查询。

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要先登录 SSO（`bytedcli auth login`）以拿到 DataLeap CoralNG JWT；JWT 鉴权自动完成。

## Supported Regions

下表的 `body.region` 值都来自真实抓包，CLI 会自动按 `--region` 映射进请求体。

| Region | 说明 | Endpoint | body.region | 必须配套的全局 site |
|--------|------|----------|-------------|---------------------|
| `cn` | 国内（默认） | data.bytedance.net | `cn` | 默认（`--site cn`） |
| `sg` | Singapore ROW | dataleap-sg.tiktok-row.net | `alisg` | **`--site i18n-tt`** |
| `va` | us-east | dataleap-va.tiktok-row.net | `i18n` | **`--site i18n-tt`** |
| `mycis` | MYCIS | dataleap-mycis.byteintl.net | `mycis` | **`--site i18n-bd`** |

> 其它区域（例如 `gcp`）尚未抓到真实 payload，暂不开放。早期曾凭 URL 路径前缀猜 va 的 `body.region` 是 `"va"`，实际值是 `"i18n"` —— 这是"看 URL 猜映射"最直接的教训。新增区域前请先在 DataLeap web 端抓一次 `CreateClickhouseTable` 请求，确认 `body.region` 的真实值，再更新 `src/api/clickhouse/site.ts`。

## --site 与 --region 的搭配（必看）

- 默认 SSO 环境是 `bytedance`，对应的 cloud site 是 `cn`。
- `sg` / `va` 的 CoralNG JWT 需要 `tiktok` 侧的 SSO token，所以**必须**在全局参数里显式加 `--site i18n-tt`，否则换字节云 JWT 的时候会直接报：

  ```text
  ✗ 获取字节云 JWT 失败: 401 (logId: ...)
  ```

  即使 `bytedcli auth status` 显示两边 SSO 都登录了也没用——问题在于 SSO 客户端默认按 `bytedance` 环境去取 access_token 换 i18n JWT，拿错了 token。

- 简单记法：
  - `--region cn` → 什么都不加（或 `--site cn`）。
  - `--region sg` / `--region va` → **一定要加 `--site i18n-tt`**。
  - `--region mycis` → **一定要加 `--site i18n-bd`**。

- `-j/--json` 模式下的提示：如果 CoralNG 返回 `code=BYTECLOUD_JWT_ERROR` 并且 `statusCode=401`，99% 的原因就是忘了加 `--site i18n-tt`。

## Quick start

```bash
# 最简建表：不传 --cluster-name，CLI 按 --database 自动反查集群（cn 示例）
bytedcli clickhouse create \
  --region cn \
  --database demo_db \
  --table demo_tbl \
  --engine HaMergeTree \
  --ttl 30 \
  --fields '[{"name":"a","type":"String"},{"name":"b","type":"Date"}]' \
  --partition-keys '[{"name":"date","type":"Date"}]' \
  --primary-key a \
  --shard-key a

# 需要指定集群时显式传 --cluster-name；sg / va 必须加 --site i18n-tt
bytedcli --site i18n-tt clickhouse create \
  --region sg \
  --database demo_db \
  --table demo_tbl \
  --cluster-name cnch_demo_cluster \
  --engine HaMergeTree \
  --ttl 30 \
  --fields '[{"name":"a","type":"String"},{"name":"b","type":"Date"}]' \
  --partition-keys '[{"name":"date","type":"Date"}]' \
  --primary-key a \
  --shard-key a

# HaUniqueMergeTree（唯一键 + 版本字段）
bytedcli --site i18n-tt clickhouse create \
  --region sg \
  --database demo_db \
  --table demo_tbl_unique \
  --engine HaUniqueMergeTree \
  --ttl 30 \
  --fields '[{"name":"a","type":"String"},{"name":"b","type":"Date"},{"name":"c","type":"UInt8"}]' \
  --partition-keys '[{"name":"date","type":"Date"}]' \
  --primary-key a \
  --shard-key a \
  --sample-key c \
  --unique-keys "sipHash64(a)" \
  --version-field c \
  --partition-level-unique-keys 1 \
  --enable-disk-based-unique-key-index 0

# 按 db 名查库元信息（cluster / virtualWarehouse / env / owners）
bytedcli clickhouse db get --region cn --database demo_db
bytedcli --site i18n-tt clickhouse db get --region sg --database demo_db
bytedcli -j --site i18n-tt clickhouse db get --region va --database demo_db

# 修改已有表的列 / 分区键 / 主键（按 GUID 定位，整表替换列定义）
# 默认：非主键列会被自动包成 Nullable(...)；主键列保持原样。需要强制非空时加 --no-auto-nullable 或把列名放进 --primary-key
bytedcli --site i18n-tt clickhouse field update \
  --region sg \
  --guid 00000000-0000-0000-0000-000000000000 \
  --fields '[{"name":"metric_id","type":"Int64","doc":"nuwa_id"},{"name":"metric_value","type":"String","doc":"指标值"}]' \
  --partition-keys '[{"name":"date","type":"Date","doc":"日期"},{"name":"project_name","type":"String","doc":"项目"}]' \
  --primary-key metric_id,date,project_name

# 修改已有表的表级属性（按 GUID 定位；CLI 会先拉当前全量属性再覆写指定字段下发，未传的 option 保留原值）
# 只改 TTL
bytedcli --site i18n-tt clickhouse attr update \
  --region sg \
  --guid 00000000-0000-0000-0000-000000000000 \
  --ttl 365

# 一次改多项：描述 + owner + 权限管理员 + 安全等级
bytedcli --site i18n-tt clickhouse attr update \
  --region sg \
  --guid 00000000-0000-0000-0000-000000000000 \
  --description "metric table" \
  --owner alice --owner bob \
  --authority-admin alice \
  --security-level 2
```

## Fields JSON 形状

`--fields` / `--partition-keys` 使用同一 schema：

```json
[{ "name": "col", "type": "String", "doc": "描述", "securityId": 72, "platform": "DataSecurityMap" }]
```

- `name` / `type` 必填；`type` 使用 ClickHouse 原生类型字符串（如 `String`、`UInt8`、`UInt64`、`Int8`、`Date`、`DateTime`）。
- `doc` 缺省时自动回落到列名。
- `securityId` / `platform` 不传时采用 DataLeap 默认“其他数据”标签（`72` / `DataSecurityMap`）。

## Notes

- 使用 `--json` 得到结构化输出，便于脚本消费。
- `--cluster-name` 不传时，CLI 会先调 `repositories/info/bulk` 按 `--database + --region` 查出集群再建表；需要在非默认集群建表或 DataLeap 未登记该 DB 时，再显式传入。
- `clickhouse db get` 输出的 `cluster` 字段就是 `--cluster-name`；`virtualWarehouse / env / owners / managers / guid / createTime / updateTime / dbSize` 一起返回。
- `--authority-admin` / `--business-contact` / `--ch-table-owner` 不传时默认使用当前 SSO 用户；`--business-contact` 可重复传入多次生成多业务联系人。
- `--partition-level-unique-keys` 与 `--enable-disk-based-unique-key-index` 按服务端契约使用字符串 `"0"` / `"1"`。
- `clickhouse field update` 的 `--fields` 与 `--partition-keys` 都是**全量**列表，会整体替换原表列定义；缺省的列会从表里被删除。`--primary-key` 使用逗号分隔的列名列表。
- 如果担心全量覆盖丢字段：传 `--append-fields`，把 `--fields` 当作“新增列列表”，CLI 会先拉取线上 schema 再 merge 后提交全量（重名列直接报错）。
- `clickhouse field update` 默认行为：非主键列、且 `type` 还不是 `Nullable(...)` 的列，会被 CLI 自动包成 `Nullable(<type>)` 再下发；主键列保持原样（ClickHouse 不允许主键为 Nullable）。复合类型（`Array(...)` / `Map(...)`）也会整体包裹。要关闭此行为，传 `--no-auto-nullable`，或把列名放进 `--primary-key`。
- `clickhouse field update` 需要表 GUID，可以从 DataLeap web 端表详情页 URL 里复制，或通过 `bytedcli hive get --guid <guid>` 验证；默认安全标签填为 DataLeap 的 `其他数据 / 其他`，cid 根据 `--region` 自动匹配，无需手动拼 `securityLabels`。
- `clickhouse attr update` 先 `GET /entities/{guid}` 解析出 qualifiedName，再 `GET /data-stores?qualifiedName=...&typeName=ClickhouseTable` 拉完整属性（entity 接口不返回 owner / 业务联系人），最后把指定字段覆写后整体 `PUT /data-stores/attributes`，避免误清空 description / owners / businessContacts 等；未传的 option 保留原值。
- `clickhouse attr update` 支持的属性 option：`--ttl <days>`（0 = 不过期）、`--description <text>` / `--description-en <text>`（空串 = 清空）、`--owner <sso>`（重复传入整体替换 owner 列表）、`--business-contact <sso>`（重复传入整体替换业务联系人列表）、`--authority-admin <sso>`、`--security-level 1|2|3`、`--is-core true|false`。必须至少传 1 个属性 option。
- 当前覆盖 ClickHouse 建表 + 改字段 + 改表级属性 + 库元信息查询；删表、引擎级属性修改尚未暴露，需要时走 DataLeap web 端。

## References

- `references/clickhouse.md`
- `references/invocation.md`
