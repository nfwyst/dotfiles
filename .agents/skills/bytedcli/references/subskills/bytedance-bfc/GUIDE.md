---
name: bytedance-bfc
description: "Operate BFC (ByteDance Flow Control) via bytedcli: query plans, union plans, products, operation execution history, and tenants. Use when tasks mention BFC, ByteDance Flow Control, 预案, 联合预案, 产品线, 执行历史, or 租户信息."
---

# BFC

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

BFC 平台的 CLI 操作工具。

## Capabilities

- 预案管理：查询预案详情与列表
- 联合预案：查询详情与列表
- 产品：列表（v3）与详情
- 预案操作执行：查询执行记录
- 租户：查询详情与列表

## Usage

```bash
# 查询预案详情
bytedcli bfc plan get --plan_key <key>

# 查询预案列表（分页+筛选）
bytedcli bfc plan list --product-id 123 --page 1 --page-size 20 --keyword <keyword>

# 查询联合预案详情
bytedcli bfc union get --union_key <key>

# 查询联合预案列表（分页+筛选）
bytedcli bfc union list --product-id 123 --page 1 --page-size 20 --status 1

# 查询产品列表（v3）
bytedcli bfc product list --version v3 --tenant-id 1001 --page 1 --page-size 20

# 查询产品详情
bytedcli bfc product get --product-id 123

# 查询预案操作执行记录
bytedcli bfc op-exec list --plan-key <key> --start-time-gte <ts> --start-time-lte <ts>

# 查询租户详情
bytedcli bfc tenant get --tenant-id 1001

# 查询租户列表（分页+筛选）
bytedcli bfc tenant list --name-like <name> --page 1 --page-size 20

# Agent 调用必须加上 --json
bytedcli --json bfc plan get --plan_key <key>
