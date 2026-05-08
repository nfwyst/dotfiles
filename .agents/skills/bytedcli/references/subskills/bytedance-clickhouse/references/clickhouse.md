# ClickHouse (DataLeap CoralNG) 建表 / 改表 / 库元信息详解

本文件是 `bytedance-clickhouse` skill 的详细参考，给出各参数的语义、典型组合与接口细节。仅当 SKILL.md 的 Quick start 不够用时再展开阅读。

## 命令概览

```bash
bytedcli clickhouse create [options]         # 建表
bytedcli clickhouse db get [options]         # 查库元信息（cluster / vwarehouse / owners ...）
bytedcli clickhouse field update [options]   # 改列 / 分区键 / 主键（按 GUID）
bytedcli clickhouse attr update [options]    # 改表级属性（TTL / 描述 / owner / 业务联系人 / 权限管理员 / 安全等级 / 核心资产标记，按 GUID）
```

- 建表走 CoralNG RCP 接口：`POST {baseUrl}{rcpPath}/management/data-store/clickhouse`，请求体为单元素数组（与 DataLeap web 端对齐）。
- 改字段走 CoralNG RCP 接口：`PUT {baseUrl}{rcpPath}/data-stores/fields`，body 包含 `guid + attributes.fields / partitionKeys / primaryKey + forceUpdate`。
- 改 TTL 走 CoralNG RCP 接口：`PUT {baseUrl}{rcpPath}/data-stores/attributes`，body 是 `{entityIds:[{guid, typeName:"ClickhouseTable"}], attributes:{...全量属性, ttl}}`；CLI 先 `GET {coralngPath}/entities/{guid}` 解析出 `qualifiedName`，再 `GET {coralngPath}/data-stores?qualifiedName=...&typeName=ClickhouseTable` 拉完整属性（entity 接口不返回 owner / 业务联系人），最后把 `ttl` 覆写后整体 PUT，避免误清空 description / owners / businessContacts 等字段。
- 库元信息走 CoralNG 非 RCP 接口：`POST {baseUrl}{coralngPath}/repositories/info/bulk`。

## `clickhouse create` 参数

### 必填

| 参数 | 说明 |
|------|------|
| `--database <db>` | 目标数据库（`db_name`）。 |
| `--table <tbl>` | 目标表（`tbl_name`）。 |
| `--engine <engine>` | 表引擎：`HaMergeTree` / `HaUniqueMergeTree` / `CnchMergeTree` 等。 |
| `--ttl <days>` | 生命周期（天）。服务端字段接收字符串，CLI 传数字即可。 |
| `--fields <json>` | 列定义 JSON 数组。`[{"name":"a","type":"String","doc":"描述"}]` |

### 可选

| 参数 | 默认 | 说明 |
|------|------|------|
| `--cluster-name <cluster>` | 自动按 `--database` 反查 | ClickHouse 集群名。不传时 CLI 会调 `repositories/info/bulk` 按 `--database + --region` 查出 `cluster` 填入。 |
| `--partition-keys <json>` | `[]` | 分区键 JSON 数组；schema 与 `--fields` 一致。 |
| `--security-level <level>` | `3` | DataLeap 数据安全等级 `1/2/3`。 |
| `--stat <stat>` | `"3"` | 可见性 stat 标志，保留默认值即可。 |
| `--is-core` | `false` | 是否标记为核心表。 |
| `--primary-key <col>` | — | ClickHouse primary key。 |
| `--shard-key <expr>` | — | Shard key 表达式，可为列名或 `sipHash64(col)`。 |
| `--sample-key <col>` | — | Sample key 列。 |
| `--version-field <col>` | — | Version 字段（HaUniqueMergeTree）。 |
| `--unique-keys <expr>` | — | Unique keys 表达式（HaUniqueMergeTree）。 |
| `--partition-level-unique-keys <flag>` | — | `"0"` / `"1"`，分区级唯一键。 |
| `--enable-disk-based-unique-key-index <flag>` | — | `"0"` / `"1"`，是否启用 disk-based unique key index。 |
| `--authority-admin <user>` | 当前 SSO 用户 | Authority admin。 |
| `--business-contact <user>` | `[authority-admin]` | 业务联系人，可重复传入。 |
| `--ch-table-owner <user>` | authority-admin | ClickHouse 表 owner。 |
| `--apply-desc <desc>` | `""` | 申请说明。 |
| `-r, --region <region>` | `cn` | 支持 `cn` / `sg` / `va` 三个已抓包验证的区域。sg/va 必须搭配全局 `--site i18n-tt`；详见下方"区域与 --site 约定"。 |

## 典型场景

### 0. 最简建表（自动反查集群）

```bash
bytedcli --site i18n-tt clickhouse create \
  --region sg \
  --database demo_db \
  --table demo_plain_tbl \
  --engine HaMergeTree \
  --ttl 7 \
  --fields '[{"name":"a","type":"String"},{"name":"b","type":"Date"}]' \
  --partition-keys '[{"name":"date","type":"Date"}]' \
  --primary-key a \
  --shard-key a
```

要点：

- 不传 `--cluster-name`，CLI 会自动按 `--database + --region` 调 `repositories/info/bulk` 反查集群。
- 若 DB 未登记或需要指定非默认集群，改用场景 1 / 2 显式传 `--cluster-name`。

### 1. HaUniqueMergeTree（去重表）

```bash
bytedcli --site i18n-tt clickhouse create \
  --region sg \
  --database pns_data_infra \
  --table demo_unique_tbl \
  --cluster-name cnch_demo_cluster \
  --engine HaUniqueMergeTree \
  --ttl 30 \
  --fields '[
    {"name":"a","type":"String","doc":"id"},
    {"name":"b","type":"Date","doc":"date"},
    {"name":"c","type":"UInt8","doc":"version"},
    {"name":"d","type":"UInt64","doc":"value"}
  ]' \
  --partition-keys '[{"name":"date","type":"Date"}]' \
  --primary-key a \
  --shard-key a \
  --sample-key c \
  --unique-keys "sipHash64(a)" \
  --version-field c \
  --partition-level-unique-keys 1 \
  --enable-disk-based-unique-key-index 0
```

要点：

- `--unique-keys` 接收 ClickHouse 表达式，与服务端要求一致。
- `--version-field` 必须指向 `--fields` 中已声明的列。
- 若使用分区级唯一键，务必同时配置 `--partition-level-unique-keys 1`。

### 2. HaMergeTree（无唯一键）

```bash
bytedcli --site i18n-tt clickhouse create \
  --region sg \
  --database demo_db \
  --table demo_plain_tbl \
  --cluster-name cnch_demo_cluster \
  --engine HaMergeTree \
  --ttl 7 \
  --fields '[{"name":"a","type":"String"},{"name":"b","type":"Date"}]' \
  --partition-keys '[{"name":"date","type":"Date"}]' \
  --primary-key a \
  --shard-key a
```

### 3. JSON 模式（Agent 消费）

```bash
bytedcli -j --site i18n-tt clickhouse create \
  --region sg \
  --database demo_db --table demo_plain_tbl \
  --engine HaMergeTree --ttl 7 \
  --fields '[{"name":"a","type":"String"}]'
```

JSON 输出形如：

```json
{ "status": "success", "data": { "database": "demo_db", "table": "demo_plain_tbl", "cluster": "cnch_demo_cluster", "clusterAutoResolved": true, "engine": "HaMergeTree", "region": "sg", "fieldsCount": 1 } }
```

`clusterAutoResolved` 为 `true` 表示 `cluster` 是 CLI 自动反查得到的；显式传入 `--cluster-name` 时为 `false`。

## `clickhouse db get`（库元信息查询）

```bash
bytedcli clickhouse db get --region cn --database demo_db
bytedcli --site i18n-tt clickhouse db get --region sg --database demo_db
bytedcli -j --site i18n-tt clickhouse db get --region va --database demo_db
```

参数：

| 参数 | 说明 |
|------|------|
| `--database <db>` | 必填，数据库名。 |
| `-r, --region <region>` | 可选，默认 `cn`。支持 `cn` / `sg` / `va`。 |

输出字段：

| 字段 | 说明 |
|------|------|
| `guid` | CoralNG 资产 id。 |
| `database` | 数据库名（回显 `--database`）。 |
| `cluster` | ClickHouse 集群名，**等于建表时的 `--cluster-name`**。 |
| `virtualWarehouse` | 关联虚拟仓。 |
| `env` | 环境标记 `prod` / `pre` / `dev`。 |
| `description` | DataLeap 上维护的描述。 |
| `creator` | 创建人（SSO）。 |
| `owners` / `managers` | 库的 owner / manager 列表。 |
| `createTime` / `updateTime` | epoch 毫秒。 |
| `dbSize` | 库大小（bytes），可能为 null。 |

JSON 模式示例：

```json
{
  "status": "success",
  "data": {
    "region": "sg",
    "database": "demo_db",
    "cluster": "cnch_demo_cluster",
    "virtualWarehouse": "vw-demo",
    "env": "prod",
    "guid": "d69389d8-485d-4081-a0f1-04d00bb6d157",
    "owners": ["demo-user"],
    "managers": ["demo-user"],
    "createTime": 1769017911097,
    "updateTime": 1776393865068,
    "dbSize": 30232814656
  }
}
```

接口差异：不同 region 的 `accurateAttributes.cid` 列表不同，CLI 已内置（不用自己拼），来自真实抓包：

| `--region` | `cid` 列表 | qualifiedName 后缀 `@cid` |
|------------|-----------|---------------------------|
| `cn` | `[0, 43, 50]` | `@0` |
| `sg` | `[6, 1]` | `@6` |
| `va` | `[1]` | `@1` |

## `clickhouse field update`（按 GUID 改列 / 分区键 / 主键）

```bash
bytedcli --site i18n-tt clickhouse field update \
  --region sg \
  --guid 00000000-0000-0000-0000-000000000000 \
  --fields '[
    {"name":"metric_id","type":"Int64","doc":"nuwa_id"},
    {"name":"metric_value","type":"String","doc":"指标值"}
  ]' \
  --partition-keys '[
    {"name":"date","type":"Date","doc":"日期"},
    {"name":"project_name","type":"String","doc":"项目"}
  ]' \
  --primary-key metric_id,date,project_name
```

> 上例里 `metric_value` 虽然写成 `"String"`，但因为不在 `--primary-key` 里，CLI 会自动把 `type` 包成 `Nullable(String)` 再发给服务端。需要强制非空，把列名加到 `--primary-key`、或显式传 `--no-auto-nullable`。

参数：

| 参数 | 说明 |
|------|------|
| `--guid <guid>` | 必填，ClickHouse 表在 DataLeap 的 asset GUID；可以从表详情页 URL 里复制，或通过 `bytedcli hive get --guid <guid>` 反查确认。 |
| `--fields <json>` | 必填，**全量**列 JSON 数组（会整体替换表的列定义）；schema 与 `clickhouse create --fields` 一致。 |
| `--partition-keys <json>` | 可选，**全量**分区键 JSON 数组；同样会整体替换。 |
| `--primary-key <keys>` | 可选，主键列列表，逗号分隔（例：`metric_id,date,project_name`）。主键列不会被自动 Nullable 包裹。 |
| `--no-auto-nullable` | 可选，关闭“非主键列自动包 `Nullable(...)`”的默认行为，让 `--fields` 里的 `type` 原样下发。 |
| `--no-force-update` | 可选，关闭 `forceUpdate`（默认是 `true`，与 DataLeap web 端一致）。 |
| `-r, --region <region>` | 可选，默认 `cn`。支持 `cn` / `sg` / `va`。sg / va 必须配套全局 `--site i18n-tt`。 |

要点：

- `--fields` / `--partition-keys` 都是**全量替换**语义，不是 diff；缺省的列会从表里被删除，确认完整列表再提交。
- `--fields` 与 `--partition-keys` 不能出现同名列（CLI 在本地做校验）。
- **默认可空语义**：`--fields` 里的列，除非列名在 `--primary-key` 里、或 `type` 已经是 `Nullable(...)`，CLI 会自动把 `type` 包成 `Nullable(<type>)` 再下发。复合类型（如 `Array(String)`）整体包裹为 `Nullable(Array(String))`。需要强制非空时，把列名加到 `--primary-key`，或传 `--no-auto-nullable` 整表关闭自动包裹。分区键不受影响（ClickHouse 本身不允许分区键是 Nullable）。
- 每一列默认被打上 DataLeap 的 `其他数据 / 其他` 安全标签（`DS-202 / other data / others`），`cid` 按 `--region` 自动填（`cn=0`，`sg=6`，`va=1`），无需手动拼 `securityLabels`。若确有自定义安全标签需求，可在单个列对象里传入 `"securityLabels": [...]` 覆盖默认值。
- 请求 URL：`PUT {baseUrl}{rcpPath}/data-stores/fields`。

请求体：

```json
{
  "guid": "00000000-0000-0000-0000-000000000000",
  "attributes": {
    "fields": [
      {
        "typeName": "ClickhouseColumn",
        "name": "metric_id",
        "dataType": "Int64",
        "comment": "nuwa_id",
        "commentEN": null,
        "securityLabels": [
          {"cid": 6, "source": "DataSecurityMap", "namespace": "DS-202", "kindCN": "其他数据", "kindEN": "other data", "nameCN": "其他", "nameEN": "others"}
        ],
        "dataRegionTags": []
      }
    ],
    "partitionKeys": [
      {"typeName": "ClickhouseColumn", "name": "date", "dataType": "Date", "comment": "日期", "commentEN": null, "securityLabels": [{"cid": 6, "source": "DataSecurityMap", "namespace": "DS-202", "kindCN": "其他数据", "kindEN": "other data", "nameCN": "其他", "nameEN": "others"}], "dataRegionTags": []}
    ],
    "primaryKey": "metric_id,date,project_name"
  },
  "forceUpdate": true
}
```

字段形状与建表接口不同：改字段走 `ClickhouseColumn` 宽结构（`typeName / dataType / comment / commentEN / securityLabels / dataRegionTags`），CLI 已经做好 `{name,type,doc}` 到这一形状的映射。

JSON 模式输出示例：

```json
{
  "status": "success",
  "data": {
    "guid": "00000000-0000-0000-0000-000000000000",
    "region": "sg",
    "fieldsCount": 2,
    "partitionKeysCount": 2,
    "primaryKey": "metric_id,date,project_name",
    "autoNullable": true,
    "fields": [
      {"name": "metric_id", "type": "Int64"},
      {"name": "metric_value", "type": "Nullable(String)"}
    ]
  }
}
```

## `clickhouse attr update`（按 GUID 改表级属性）

```bash
# 只改 TTL
bytedcli --site i18n-tt clickhouse attr update \
  --region sg \
  --guid 00000000-0000-0000-0000-000000000000 \
  --ttl 365

# 一次改多项：描述 + owner + 业务联系人 + 权限管理员
bytedcli --site i18n-tt clickhouse attr update \
  --region sg \
  --guid 00000000-0000-0000-0000-000000000000 \
  --description "metric table" \
  --description-en "metric table (EN)" \
  --owner alice --owner bob \
  --business-contact alice \
  --authority-admin alice

# 只改安全等级与核心资产标记
bytedcli --site i18n-tt clickhouse attr update \
  --region sg \
  --guid 00000000-0000-0000-0000-000000000000 \
  --security-level 2 \
  --is-core false
```

参数：

| 参数 | 说明 |
|------|------|
| `--guid <guid>` | 必填，ClickHouse 表的 asset GUID。可以从 DataLeap web 端表详情页 URL 里复制，或先跑 `bytedcli hive get --guid <guid> -r <region>` 确认表真的在目标 region。 |
| `--ttl <days>` | 可选。生命周期天数（非负整数，`0` 表示不过期，与 DataLeap web 端语义一致）。 |
| `--description <text>` | 可选。中文描述；传空串 `""` 等价于清空（写 `null`）。 |
| `--description-en <text>` | 可选。英文描述；传空串 `""` 等价于清空。 |
| `--owner <sso>` | 可选，可重复。表级 owner（`userNames`）。**整体替换**原 owner 列表，不做追加；例如 `--owner a --owner b` 会把 userNames 改成 `["a","b"]`。 |
| `--business-contact <sso>` | 可选，可重复。业务联系人（`businessContacts`）。语义同 `--owner`：整体替换。 |
| `--authority-admin <sso>` | 可选。权限管理员（单个 SSO 用户，非空字符串）。 |
| `--security-level <level>` | 可选。安全等级，取值 `1` / `2` / `3`（对应 DataLeap `securityTag.currentSecurityLevel`）。 |
| `--is-core <bool>` | 可选。核心资产标记，取值 `true` / `false`（字符串）。 |
| `-r, --region <region>` | 可选，默认 `cn`。支持 `cn` / `sg` / `va`。sg / va 必须配套全局 `--site i18n-tt`。 |

约束：必须至少传 1 个上面带 "可选" 标记的属性 option，否则 CLI 会直接报错，不会发请求。

行为：

- 拉当前属性是两步：
  1. `GET {baseUrl}{coralngPath}/entities/{guid}?cid=<region-cid>` 解析出 `qualifiedName` 与 `typeName`；Atlas 风格的 entity 视图**不返回** `userNames` / `businessContacts` / `authorityAdmin` 等 owner 字段，不能单独当作回填来源。
  2. `GET {baseUrl}{coralngPath}/data-stores?qualifiedName=<qn>&typeName=ClickhouseTable&...` 拿到 DataLeap web 端表详情页实际使用的完整 attribute bag（含 owner / 业务联系人 / securityTag / businessLines / ...）。
- 把用户传入的字段覆写后整体 PUT 到 `{baseUrl}{rcpPath}/data-stores/attributes`；未传的 option 保留原值。整体 PUT 是因为 DataLeap web 端也是"全量回填 + 改动覆盖"的语义，避免未传字段被服务端重置。
- 历史实现只跑第一步，会把 owner / 业务联系人写成空数组清空表 owner；当前两步方案已修复该回归。
- `authorityAdmin` 两个读接口都不返回，CLI 以 override > 原值 > `userNames[0]` > `businessContacts[0]` 的顺序推导，和 DataLeap web 端一致。
- `--owner` / `--business-contact` 语义是**整体替换**，不做增量追加；如需保留旧 owner 再加新 owner，请在 option 里显式列出完整列表。
- 请求 URL：`PUT {baseUrl}{rcpPath}/data-stores/attributes`。
- 其它 DataLeap 属性（如 `businessLines` / `dataLayerList` / `storageStrategyList` / `tagNames` 等）CLI 未暴露 option；如需调整，走 DataLeap web 端，或在 API 层直接调用 `api.clickhouse.modifyAttributes({ guid, overrides: { ... } })`，所有 `ClickhouseAttributeOverrides` 字段都支持。

请求体（示例，真实抓包形状）：

```json
{
  "entityIds": [
    {"guid": "00000000-0000-0000-0000-000000000000", "typeName": "ClickhouseTable"}
  ],
  "attributes": {
    "alias": null,
    "aliasEN": null,
    "description": null,
    "descriptionEN": null,
    "userNames": ["demo-user"],
    "hide": false,
    "businessContacts": ["demo-user"],
    "businessLines": [],
    "dataLayerList": [],
    "dataCategoryList": [{}],
    "storageStrategyList": [],
    "businessLine": null,
    "dataLayer": null,
    "dataCategories": [],
    "storageStrategy": null,
    "securityLevel": 2,
    "authorityAdmin": "demo-user",
    "ttl": 365,
    "dataRegionTags": null,
    "status": 3,
    "isCore": false,
    "businessDomain": null,
    "theme": null,
    "productLines": null,
    "businessGlossary": null,
    "tagNames": null,
    "assetSystemTagList": [{}]
  }
}
```

JSON 模式输出示例：

```json
{
  "status": "success",
  "data": {
    "guid": "00000000-0000-0000-0000-000000000000",
    "region": "sg",
    "previous": {
      "ttl": 32,
      "description": null,
      "descriptionEN": null,
      "authorityAdmin": "demo-user",
      "userNames": ["demo-user"],
      "businessContacts": ["demo-user"],
      "securityLevel": 2,
      "isCore": false
    },
    "current": {
      "ttl": 365,
      "description": "metric table",
      "descriptionEN": null,
      "authorityAdmin": "demo-user",
      "userNames": ["demo-user"],
      "businessContacts": ["demo-user"],
      "securityLevel": 2,
      "isCore": false
    },
    "changed": [
      {"field": "ttl", "from": 32, "to": 365},
      {"field": "description", "from": null, "to": "metric table"}
    ]
  }
}
```

`previous` / `current` 永远是同一份属性快照结构，方便 agent 直接做 diff；`changed` 只包含**值真的变了**的字段（即使 override 和原值相同，也不会出现在 `changed` 里）。

## 请求体说明

最终 POST 的 body 是数组包装的 CoralNG 结构：

```json
[{
  "region": "alisg",
  "dataset_type": "Table",
  "datasource": "clickhouse",
  "type": "CREATE_TB",
  "cluster_name": "cnch_demo_cluster",
  "db_name": "demo_db",
  "tbl_name": "demo_tbl",
  "engine": "HaUniqueMergeTree",
  "current_security_level": 3,
  "authority_admin": "<sso-user>",
  "ttl": "30",
  "stat": "3",
  "fields": [{"name":"a","doc":"a","type":"String","security_id":72,"platform":"DataSecurityMap"}],
  "partition_keys": [{"name":"date","doc":"date","type":"Date","security_id":72,"platform":"DataSecurityMap"}],
  "business_contacts": ["<sso-user>"],
  "ch_table_owner": "<sso-user>",
  "business_glossaries": null,
  "apply_desc": "",
  "is_core": false,
  "primary_key": "a",
  "shard_key": "a",
  "unique_keys": "sipHash64(a)",
  "version_field": "c",
  "partition_level_unique_keys": "1",
  "enable_disk_based_unique_key_index": "0"
}]
```

字段名对应的 CLI 选项由 handler/ api 层完成 camelCase ↔ snake_case 映射，不需要用户自行拼接。

## 区域与 --site 约定

当前 CLI 只开放经过真实抓包验证的三个区域：

| `--region` | `body.region`（自动映射） | 必须配套的全局 site |
|------------|--------------------------|---------------------|
| `cn` | `cn` | 默认（`--site cn`） |
| `sg` | `alisg` | **`--site i18n-tt`** |
| `va` | `i18n` | **`--site i18n-tt`** |

**为什么 sg/va 必须加 `--site i18n-tt`**：

- SSO 客户端是按全局 `--site` 选择用哪个 SSO 环境拿 access_token 的（默认是 `bytedance`）。
- `sg` / `va` 的 CoralNG JWT 需要 `tiktok` 侧的 access_token 去签发。
- 默认 site 下，SSO 客户端会拿 `bytedance` 的 access_token 去请求 i18n 的 JWT 端点，被直接拒掉，表现为：

  ```text
  ✗ 获取字节云 JWT 失败: 401 (logId: ...)
  ```

- 即使 `bytedcli auth status` 显示 `bytedance` 和 `tiktok` 两个环境都登录了也没用——选错了环境就是选错了 token。
- 解决方法：**所有 `--region sg` / `--region va` 的命令都前置 `--site i18n-tt`**，CLI 就会从 tiktok 侧拿 access_token，JWT 换发正常。

已知局限：目前 CLI 层没有根据 `--region` 自动修正 `--site` 的逻辑，如果要修是 `src/auth/sso.ts` 里 `getBytecloudJwtForSite` 的跨环境分支（`if (!token && authEnv !== this.config.environment)` 那段要扩成无条件跨环境拉 token），blast radius 较大，暂时以"文档+显式参数"的方式规避。

## 故障排查

- **`获取字节云 JWT 失败: 401`**：最常见原因是 `--region sg` / `--region va` 场景下没加 `--site i18n-tt`；加上之后重试即可。如果已经加了还是 401，检查 `bytedcli auth status` 里 `tiktok` 环境是否掉线，必要时 `bytedcli --site i18n-tt auth login` 重新登录。
- **`Failed to auto-resolve cluster for database ...`**：说明该 region 下 `repositories/info/bulk` 查不到对应 DB，或 DataLeap 尚未登记该库。显式传 `--cluster-name` 即可绕过；先通过 `clickhouse db get` 验证也可以。
- **`ClickHouse database not found`**：`clickhouse db get` 在该 region 查不到 DB。确认 DB 名拼写与大小写、region 是否对（cn 集群和 sg/va 集群不互通）。
- **`cluster not found`（建表阶段）**：多数是 `--cluster-name` 在该 region 不存在。确认集群名是从 DataLeap web 端复制的，或直接用 `clickhouse db get` 的结果；常见 cn 集群和 sg 集群不互通。
- **`authority-admin` 无法解析**：当前未登录 SSO，或 SSO token 过期。显式传 `--authority-admin <user>` 或先执行 `bytedcli auth login`。
- **字段重复校验失败**：`--fields` 与 `--partition-keys` 内部不允许重复列名；两边也不允许重名。先本地合并去重再提交。
- **`CoralNG ClickHouse modify fields failed`（改字段阶段）**：多半是 `--guid` 传错或与 `--region` 不匹配（比如 `sg` 表的 GUID 用 `--region cn` 去 PUT）。先用 `bytedcli hive get --guid <guid> -r <region>` 确认表确实在目标 region。
- **需要使用新区域（gcp / mycis 等）**：CLI 目前只支持 `cn` / `sg` / `va`。新区域的 `body.region` 与 `bulkCids` 都不能从 URL 路径猜（早期 `va` 被错估为 `"va"`，真实值是 `"i18n"`）；请先在 DataLeap web 端抓一次 `CreateClickhouseTable` + `repositories/info/bulk` 请求，拿到真实值后再在 `src/api/clickhouse/site.ts`、`types.ts`、`parsers.ts` 补进来。
