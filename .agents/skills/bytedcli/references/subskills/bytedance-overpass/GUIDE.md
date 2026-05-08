---
name: bytedance-overpass
description: "Operate Overpass: IDL-based codegen for kitex/hertz/lust/euler/jet/js, sync IDL, query config, generate branches, and manage project repos/subscriptions."
---

# Overpass（bytedcli）

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

Overpass 用于 **基于 IDL 生成代码**（Kitex / Hertz / Lust / Euler / Jet / JS 等框架）。

## When to use

- 同步 IDL / 查询 repo 配置
- 生成分支代码并拉取生成产物
- 按项目维度查询 repo 列表、分支状态、管理代码生成订阅

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要登录 SSO：`bytedcli auth login`
- `generate-branch` 基于 **IDL 远端分支** 生成，不读取本地未提交改动
- 执行 `generate-branch` 前，必须先完成：
  1. IDL 改动已 commit 并 push 到远端分支
  2. `sync-idl-info` 返回成功
  3. `get-branch-idl` 中目标分支可见且版本非异常（避免长期停留在 `Version=0`）

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 获取 repo 配置
bytedcli overpass get-repo-info --psm "example.service.api"

# 同步/查询 IDL
bytedcli overpass sync-idl-info --psm "example.service.api" --branch "feat/demo"
bytedcli overpass get-branch-idl --psm "example.service.api" --branch "feat/demo"
bytedcli overpass get-latest-idl --psm "example.service.api"

# 分支生成与任务查询
bytedcli overpass generate-branch --psm "example.service.api" --branch "feat/demo"
bytedcli overpass search-branch-task --psm "example.service.api" --framework-type kitex
bytedcli overpass search-main-task --psm "example.service.api" --framework-type kitex
```

### 项目维度操作

```bash
# 按名称搜索项目 repo
bytedcli overpass project query-repo --repo-name "example"

# 查询项目的分支记录
bytedcli overpass project query-branch --project-id 610

# 创建或更新分支的代码生成订阅
bytedcli overpass project create-or-update-branch --project-id 610 --branch "feat/demo" --subscribe-users alice bob

# 取消订阅
bytedcli overpass project create-or-update-branch --project-id 610 --branch "feat/demo" --no-subscribed
```

## Notes

- `generate-branch` 默认执行 `go get` 获取生成后的 Go 代码
- 非 Go 生态可使用 `--disable-goget`
- `--framework-type` 支持 `kitex|hertz|lust|euler|jet|js|gulux|gdp`，也兼容旧数字写法
- 需要结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json overpass get-repo-info ...`）
- 若 `generate-branch` 异常，优先使用 `--http-debug --http-print hbmt` 定位后端返回
- 项目维度命令通过 `overpass project <subcommand>` 调用，子命令包括 `query-repo`、`query-branch`、`create-or-update-branch`
- `create-or-update-branch` 的 `--subscribe-users` 为可选参数，未传时不会覆盖已有的订阅用户列表（避免误删）；`--subscribed` 默认为 `true`，取消订阅使用 `--no-subscribed`
- 项目维度命令的 `--project-id` 和分页参数（`--page`、`--page-size`）必须为正整数

## References

- `references/invocation.md`
- `references/troubleshooting.md`
