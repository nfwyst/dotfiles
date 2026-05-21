---
name: bytedance-decc
description: "Operate DECC (Data Exchange & Cross-region Compute) via bytedcli: create HDFS channels, register HDFS data (tables), apply for channel/data permissions, and inspect ticket comments. Use when tasks mention DECC, OG tagging, cross-region data exchange, HDFS channel, DECC data registration, DECC permission application, or DECC ticket comments."
---

# bytedcli DECC (Data Exchange & Cross-region Compute)

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

- 创建 DECC HDFS channel（数据交换渠道）
- 在 channel 下注册 DECC HDFS data（表）
- 申请 channel 或 data 的 Owner 权限
- 查询 DECC ticket 评论详情
- 跨区域数据交换（Cross-region Data Exchange）场景
- 查询待打标 API 服务与已有打标记录
- 创建 API OG 打标草稿
- 对 API 进行 OG 打标（更新打标草稿）

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- DECC 命令使用 `--site i18n-tt`（TikTok 国际站），需单独登录：

```bash
# 检查认证状态
bytedcli --site i18n-tt auth status

# 登录（如未认证）
bytedcli --site i18n-tt auth login
```

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 查询 Gateway service 列表
bytedcli --site i18n-tt decc gateway service list

# 按 service name、region、owner 或 source type 过滤
bytedcli --site i18n-tt decc gateway service list \
  --name demo.api_service \
  --region EU,US \
  --owners demo.user,sample.user \
  --source-type Web

# 查询指定 Gateway service entity 下的 endpoint
bytedcli --site i18n-tt decc gateway endpoint list \
  --entity-id demo-service-entity-id \
  --stage draft \
  --page 1 \
  --page-size 15

# 查询指定 Gateway endpoint
bytedcli --site i18n-tt decc gateway endpoint get \
  --id demo-endpoint-id \
  --stage draft

# 创建 Gateway endpoint draft
bytedcli --site i18n-tt decc gateway endpoint create \
  --entity-id demo-service-entity-id \
  --path /demo/api \
  --method GET \
  --description "demo endpoint"

# 更新 Gateway endpoint draft 的描述和 schema
bytedcli --site i18n-tt decc gateway endpoint update \
  --draft-id demo-endpoint-id \
  --description "updated demo endpoint" \
  --req-headers-file req_headers.json \
  --req-body-file req_body.json

# 创建 HDFS channel
bytedcli --site i18n-tt decc hdfs-channel create \
  --name demo-database \
  --description "demo channel" \
  --owners demo.user \
  --vgeo-list CN \
  --scenario 4

# 在 channel 下注册 HDFS data（表）
bytedcli --site i18n-tt decc hdfs-data create \
  --channel-id demo-channel-id \
  --name demo_table_name \
  --owners demo.user \
  --region EU-TTP2 \
  --scenario 3

# 申请 channel Owner 权限
bytedcli --site i18n-tt decc apply \
  --object-type 1 \
  --object-key demo-channel-id \
  --users demo.user \
  --reason "申请 channel 权限"

# 申请 data Owner 权限
bytedcli --site i18n-tt decc apply \
  --object-type 2 \
  --object-key demo-data-id \
  --users demo.user \
  --reason "申请 data 权限"

# 查询 ticket 评论详情
bytedcli --site i18n-tt decc ticket comment \
  --ticket-id demo-ticket-id

# JSON 输出
bytedcli --site i18n-tt --json decc ticket comment \
  --ticket-id demo-ticket-id
```

## 枚举值参考

### DECC Region

`Singapore-Central`, `EU-TTP2`, `US-EastRed`, `EU-Compliance2`, `US-TTP`, `Asia-SouthEastBD`, `Asia_Saas`, `Singapore_Saas`, `Asia_CIS`

### vGeo Region

`ROW-TT`, `NonTT`, `US`, `EU`, `CN`

### Scenario

| 值  | 名称                    | 说明                       |
| --- | ----------------------- | -------------------------- |
| 0   | UNKNOWN_SCENARIO        | 未知场景                   |
| 1   | ALL_SCENARIO            | 全部场景                   |
| 2   | TEXAS                   | Texas 数据主权场景         |
| 3   | CLOVER                  | Clover 数据主权场景        |
| 4   | CN_CROSS_BORDER         | CN 跨境传输场景            |
| 5   | TT_NONTT                | TT&NonTT 数据隔离场景      |
| 6   | EU_US_DIRECT_CONNECTION | EU-US 专线场景             |
| 7   | ROW_HDFS_BOE            | row-hdfs/boe 网关场景      |
| 8   | ROW_HDFS_PRODUCTION     | row-hdfs/prod 网关场景     |
| 9   | RPC_TEXAS_CLOVER_MIXED  | RPC-Texas/Clover 混合场景  |
| 10  | HDFS_TEXAS_CLOVER_MIXED | HDFS-Texas/Clover 混合场景 |

### Object Type（apply 命令）

| 值  | 类型    | 自动分配角色  |
| --- | ------- | ------------- |
| 1   | channel | Channel Owner |
| 2   | data    | Data Owner    |

### Gateway Service Source Type

`Web`, `Log`, `Metric`, `CommonHeader`

## Notes

- `gateway endpoint list` 的 stage 仅支持 `approved` 和 `draft`
- `gateway endpoint get` 的 stage 仅支持 `approved` 和 `draft`
- `gateway endpoint create` 必填 `--entity-id`、`--path`、`--method`、`--description`；`--owners` 可选，省略时使用 operator
- `gateway endpoint update` 自动使用当前登录用户作为 operator；命令不需要也不支持手动传 operator
- `gateway endpoint update` 会先查询 draft detail，并沿用 detail 中的 `attributes.assurance_paths`
- `gateway endpoint update` 的 schema 字段只支持从文件读取：`--query-file`、`--path-file`、`--req-headers-file`、`--req-body-file`、`--resp-headers-file`、`--resp-body-file`
- `ticket comment` 通过 `--ticket-id` 查询评论详情
- `hdfs-data create` 和 `hdfs-channel create` 的 gateway 固定为 HDFS（6）
- `apply` 命令的 role 根据 `--object-type` 自动推断：1 → Channel Owner，2 → Data Owner
- `hdfs-data create` 默认 scenario 为 3（CLOVER）
- `hdfs-channel create` 默认 scenario 为 4（CN_CROSS_BORDER）
- 需要结构化输出加 `--json`（全局选项，放在子命令之前）

## References

- `references/decc.md`
- `references/invocation.md`
