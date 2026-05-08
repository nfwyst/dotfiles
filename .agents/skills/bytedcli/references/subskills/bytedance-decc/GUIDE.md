---
name: bytedance-decc
description: "Operate DECC (Data Exchange & Cross-region Compute) via bytedcli: create HDFS channels, register HDFS data (tables), and apply for channel/data permissions. Use when tasks mention DECC, cross-region data exchange, HDFS channel, DECC data registration, or DECC permission application."
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
- 跨区域数据交换（Cross-region Data Exchange）场景

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
# 创建 HDFS channel
bytedcli --site i18n-tt decc hdfs-channel create \
  --name demo-database \
  --description "demo channel" \
  --owners demo.user \
  --vgeo-list CN \
  --scenario 4

# 在 channel 下注册 HDFS data（表）
bytedcli --site i18n-tt decc hdfs-data create \
  --channel-id 7252920295022035206 \
  --name demo_table_name \
  --owners demo.user \
  --region EU-TTP2 \
  --scenario 3

# 申请 channel Owner 权限
bytedcli --site i18n-tt decc apply \
  --object-type 1 \
  --object-key 7252920295022035206 \
  --users demo.user \
  --reason "申请 channel 权限"

# 申请 data Owner 权限
bytedcli --site i18n-tt decc apply \
  --object-type 2 \
  --object-key 7314310435141632262 \
  --users demo.user \
  --reason "申请 data 权限"

# JSON 输出
bytedcli --site i18n-tt --json decc hdfs-data create \
  --channel-id 7252920295022035206 \
  --name demo_table_name \
  --owners demo.user \
  --region EU-TTP2
```

## 枚举值参考

### DECC Region

`Singapore-Central`, `EU-TTP2`, `US-EastRed`, `EU-Compliance2`, `US-TTP`, `Asia-SouthEastBD`, `Asia_Saas`, `Singapore_Saas`, `Asia_CIS`

### vGeo Region

`ROW-TT`, `NonTT`, `US`, `EU`, `CN`

### Scenario

| 值 | 名称 | 说明 |
|----|------|------|
| 0 | UNKNOWN_SCENARIO | 未知场景 |
| 1 | ALL_SCENARIO | 全部场景 |
| 2 | TEXAS | Texas 数据主权场景 |
| 3 | CLOVER | Clover 数据主权场景 |
| 4 | CN_CROSS_BORDER | CN 跨境传输场景 |
| 5 | TT_NONTT | TT&NonTT 数据隔离场景 |
| 6 | EU_US_DIRECT_CONNECTION | EU-US 专线场景 |
| 7 | ROW_HDFS_BOE | row-hdfs/boe 网关场景 |
| 8 | ROW_HDFS_PRODUCTION | row-hdfs/prod 网关场景 |
| 9 | RPC_TEXAS_CLOVER_MIXED | RPC-Texas/Clover 混合场景 |
| 10 | HDFS_TEXAS_CLOVER_MIXED | HDFS-Texas/Clover 混合场景 |

### Object Type（apply 命令）

| 值 | 类型 | 自动分配角色 |
|----|------|------------|
| 1 | channel | Channel Owner |
| 2 | data | Data Owner |

## Notes

- `hdfs-data create` 和 `hdfs-channel create` 的 gateway 固定为 HDFS（6）
- `apply` 命令的 role 根据 `--object-type` 自动推断：1 → Channel Owner，2 → Data Owner
- `hdfs-data create` 默认 scenario 为 3（CLOVER）
- `hdfs-channel create` 默认 scenario 为 4（CN_CROSS_BORDER）
- 需要结构化输出加 `--json`（全局选项，放在子命令之前）

## References

- `references/decc.md`
- `references/invocation.md`
