---
name: bytedance-bfo
description: "Operate BFO (Byte FinOps) via bytedcli: search service tree nodes, query CPU spec upgrade summary/clusters/details/profit. Use when tasks mention BFO, Byte FinOps, CPU spec upgrade, CPU 规格升级, 规格升配, 性能优化, or 收益回收."
---

# BFO

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

BFO (Byte FinOps) 平台的 CLI 操作工具，当前支持 CPU 规格升级查询。

## Capabilities

- 服务树搜索：通过关键词搜索 Galaxy 服务树节点，获取 node ID
- CPU 规格升级概览：查看指定服务树节点下的 CPU 规格升级推荐覆盖范围与预估收益
- 逻辑集群列表：分页列出推荐升级的逻辑集群，支持按 Pod CPU 规格过滤
- 物理集群详情：查看逻辑集群下的物理集群规格详情（当前规格、建议规格、预期收益）
- 收益回收记录：查看 CPU 规格优化后的实际收益回收数据

## Usage

```bash
# 搜索服务树节点（获取 node-id）
bytedcli bfo tree search --keyword example-service

# CPU 规格升级概览
bytedcli bfo cpu-spec summary --node-id 17

# 列出推荐升级的逻辑集群（分页）
bytedcli bfo cpu-spec list --node-id 17 --page-num 1 --page-size 20

# 按 Pod CPU 规格过滤（小于 8 核）
bytedcli bfo cpu-spec list --node-id 17 --cpu-spec 8

# 查看物理集群详情
bytedcli bfo cpu-spec detail --psm example.service.api --cluster default

# 指定 region
bytedcli bfo cpu-spec detail --psm example.service.api --cluster default --region China-East

# 查看收益回收记录
bytedcli bfo cpu-spec profit --node-id 17

# Agent 调用必须加上 --json
bytedcli --json bfo tree search --keyword example-service
bytedcli --json bfo cpu-spec summary --node-id 17
bytedcli --json bfo cpu-spec list --node-id 17
bytedcli --json bfo cpu-spec detail --psm example.service.api --cluster default
bytedcli --json bfo cpu-spec profit --node-id 17
```

## Common Options

| Option | Description | Default |
|--------|-------------|---------|
| `--region <region>` | Region | `China-North` |
| `--page-num <num>` | Page number | `1` |
| `--page-size <size>` | Page size | `10` |
| `-j, --json` | JSON output | - |
