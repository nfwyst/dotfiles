---
name: bytedance-oncall
description: "通过 bytedcli 操作 ByteCloud Oncall Platform。适用于查询 oncall 工单列表/详情、创建 oncall 工单、搜索服务台、查看服务台类型与元数据。与 `lark-oncall` 不同，此命令面向 ByteCloud Oncall Platform（cloud.bytedance.net/oncall）。"
---

# bytedcli oncall (ByteCloud Oncall Platform)

当任务涉及 ByteCloud Oncall Platform 的工单查询、创建或服务台管理时，优先使用 `bytedcli oncall`：

- `flow list`：列出 oncall 工单，支持按发起人、处理人、服务台 ID、关键词、是否已解决等过滤。
- `flow get`：获取单个 oncall 工单详情。
- `flow create`：创建新的 oncall 工单。
- `tenant search`：按关键词搜索服务台。
- `tenant list`：列出当前用户关联的服务台。
- `tenant get`：获取服务台详情。
- `tenant types`：列出指定服务台下可用的 oncall 类型（创建工单前需要此信息）。
- `meta types|tags|roles|sources`：查看 oncall 平台的全局元数据枚举。

> **注意**：此命令面向 ByteCloud Oncall Platform（`cloud.bytedance.net/oncall`），与 `lark-oncall`（Lark Oncall）是不同的平台。

## 认证

使用 ByteCloud SSO JWT 认证，与 `cloud-ticket` 等 ByteCloud 命令共享认证方式。

```bash
bytedcli auth login
```

## 常见流程

```bash
# 查看我发起的 oncall 工单
bytedcli oncall flow list --originator example-user

# 查看我处理的未解决 oncall
bytedcli oncall flow list --handler example-user --unsolved

# 按服务台筛选
bytedcli oncall flow list --tenant-id 12345 --page-size 20

# 按关键词搜索
bytedcli oncall flow list --keyword example-query

# 查看单个 oncall 详情
bytedcli oncall flow get --id 100000000001

# 搜索服务台
bytedcli oncall tenant search --keyword example-service

# 查看我关联的服务台
bytedcli oncall tenant list

# 查看服务台详情
bytedcli oncall tenant get --id 12345

# 查看服务台下的 oncall 类型（创建工单前需要）
bytedcli oncall tenant types --tenant-id 54321

# 创建 oncall 工单
bytedcli oncall flow create --tenant-id 54321 --type-id 99999 --message 'example issue description'

# 创建指定优先级的 oncall
bytedcli oncall flow create --tenant-id 54321 --type-id 99999 --priority P1 --message 'urgent issue'

# 查看全局元数据
bytedcli oncall meta types
bytedcli oncall meta tags
bytedcli oncall meta roles
bytedcli oncall meta sources
```

需要机器可读输出时，全局 `--json` 要放在 domain 前面：

```bash
bytedcli --json oncall flow list --originator example-user --page-size 50
bytedcli --json oncall flow get --id 100000000001
```

## Agent Guidance

- 创建 oncall 前，先用 `tenant search` 找到目标服务台 ID，再用 `tenant types` 获取可用的 type_id。
- `flow list` 命令的 `--tenant-id` 支持重复传入多个 ID。
- 默认站点为 `cn`，可通过 `--site boe` 切换到 BOE 环境。
- 工单 ID 是数字格式（如 100000000001），不是 ticket_xxx 格式（后者属于 Lark Oncall）。
