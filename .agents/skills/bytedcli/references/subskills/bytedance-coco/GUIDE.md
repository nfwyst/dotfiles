---
name: bytedance-coco
description: 'Coco (Codebase Copilot) AI Code Agent — 发送 AI 编程任务、管理 Sandbox 云空间和 Environment 环境模板、查看模型和 Prompt。当用户提到 Coco、coco、AI 编程任务、代码助手、Codebase Copilot、sandbox 云空间、copilot 任务、coco task、coco sandbox、coco env、代码生成、代码审查时使用。'
---

# Coco (Codebase Copilot)

Coco 是字节跳动 Codebase 团队的 AI Code Agent 产品，提供代码生成、代码审查、多轮对话、任务管理等 AI 编程能力。

## When to use

- 发送 AI 编程任务（代码生成、代码审查、代码修复）
- 订阅或获取任务执行结果
- 管理任务：列表、删除、分享、查看事件
- 创建/删除 Sandbox 云空间
- 管理 Environment 环境配置模板
- 查看可用模型或 Prompt
- 检查飞书授权状态

## Prerequisites

- 认证：与 `bytedcli codebase` 共享，执行 `bytedcli auth login`
- 调用方式：参考 `references/invocation.md`

## Quick start — 核心工作流

### 发任务 → 看结果（三步走）

```bash
# 1. 发送编程任务（返回 Task ID）
bytedcli coco task send --message "帮我写一个 Python 斐波那契函数"

# 2. 实时订阅任务进度（SSE 流式）
bytedcli coco task subscribe --task-id <TaskId>

# 3. 或轮询获取最终结果
bytedcli coco task get --task-id <TaskId>
```

### 结合仓库上下文

```bash
# 指定仓库，Coco 拉取代码进行分析
bytedcli coco task send \
  --message "帮这个仓库写一个 README，提交 MR" \
  --repo-id 12345 --branch main

# 代码审查
bytedcli coco task send \
  --message "Review this MR" \
  --repo-id 12345 --merge-request-number 42
```

### 多轮对话

```bash
# 用 --task-id 继续上一轮任务
bytedcli coco task send --message "再加上单元测试" --task-id <TaskId>
```

### Sandbox 模式（独立云空间）

```bash
# sandbox 模式：独立云空间，适合离线/批量任务
bytedcli coco task send --agent-name sandbox --message "格式化所有 Go 文件" --repo-id 12345

# 自定义运行环境
bytedcli coco task send --agent-name sandbox \
  --message "编译项目" --repo-id 12345 \
  --environment-image example.registry.com/golang:1.22 \
  --environment-var "GOPROXY=https://goproxy.cn"

# 在已有 Sandbox 中执行
bytedcli coco task send --message "跑单测" --environment <sandbox-id>
```

### Sandbox 和 Environment 管理

```bash
# 创建 Sandbox（自定义镜像 + 环境变量）
bytedcli --json coco sandbox create \
  --image example.registry.com/dev:latest \
  --var "LC_ALL=zh_CN.UTF-8"

# 创建可复用的 Environment 模板
bytedcli coco env create \
  --name "my-dev-env" \
  --image example.registry.com/dev:latest \
  --var "NODE_ENV=development" \
  --label "team=demo"

# 用模板创建 Sandbox
bytedcli coco sandbox create --environment-id <env-id>
```

### 其他常用

```bash
# 查看可用模型
bytedcli coco model list

# 查看可用 prompts
bytedcli coco prompt list --repo-id 12345

# 列出任务
bytedcli coco task list --page-size 10

# 分享任务
bytedcli coco task share --task-id <TaskId>

# 检查飞书授权
bytedcli coco auth check-lark
```

## Available Commands

### Task（任务管理）

| Command | Key Options | Description |
|---------|-------------|-------------|
| `coco task send` | `--message`, `--repo-id`, `--agent-name`, `--task-id`, `--model-name`, `--branch`, `--merge-request-number`, `--environment`, `--environment-image`, `--environment-var`, `--environment-ttl` | 发送编程任务或继续多轮对话 |
| `coco task get` | `--task-id` | 获取任务详情和结果 |
| `coco task list` | `--repo-id`, `--statuses`, `--title`, `--page`, `--page-size` | 列出任务 |
| `coco task delete` | `--task-id` | 删除任务 |
| `coco task share` | `--task-id` | 生成分享链接 |
| `coco task events` | `--task-id` | 列出任务事件 |
| `coco task subscribe` | `--task-id`, `--event-offset` | SSE 实时订阅任务进度 |

### Chat（AI 对话）

| Command | Key Options | Description |
|---------|-------------|-------------|
| `coco chat` | `--message`, `--repo-id`, `--commit-id`, `--no-stream` | SSE 流式 AI 对话 |

### Model & Prompt

| Command | Key Options | Description |
|---------|-------------|-------------|
| `coco model list` | — | 列出可用模型 |
| `coco prompt list` | `--repo-id` | 列出 prompts |
| `coco prompt get` | `--name`, `--repo-id` | 获取 prompt 详情 |

### Sandbox（云空间）

| Command | Key Options | Description |
|---------|-------------|-------------|
| `coco sandbox create` | `--environment-id` 或 `--image`, `--var`, `--secret`, `--ttl`, `--repo`, `--cwd` | 创建 Sandbox 实例 |
| `coco sandbox delete` | `--id` | 删除 Sandbox |

### Environment（环境模板）

| Command | Key Options | Description |
|---------|-------------|-------------|
| `coco env create` | `--name`, `--image`, `--var`, `--secret`, `--label`, `--ttl`, `--repo-id`, `--cwd` | 创建环境模板 |
| `coco env get` | `--id` | 获取环境详情 |
| `coco env list` | `--repo-id`, `--label` | 列出环境 |
| `coco env update` | `--id`, 加其他字段 | 更新环境 |
| `coco env delete` | `--id` | 删除环境 |
| `coco env search` | `--label` | 搜索环境 |

### Auth

| Command | Key Options | Description |
|---------|-------------|-------------|
| `coco auth check-lark` | `--origin-url` | 检查飞书授权状态 |

## 两种任务模式

| | Copilot（默认） | Sandbox |
|---|---|---|
| 用法 | `--agent-name copilot` 或省略 | `--agent-name sandbox` |
| 特点 | 在线交互，共享后端服务 | 独立云空间，每个任务隔离 |
| 适合 | 需要交互确认的任务 | 已调教好的 prompt，批量/离线任务 |

## Notes

- 所有命令支持 `--json` 输出 JSON：`bytedcli --json coco task list`
- 任务创建后可在 Web 查看：`https://code.byted.org/copilot`
- `--environment` 参数接受 Sandbox ID 或 Environment ID
- `--var KEY=VALUE` 和 `--label KEY=VALUE` 可重复传入多个
- 遇到问题参考 `references/troubleshooting.md`
