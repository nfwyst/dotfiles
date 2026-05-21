---
name: bytedance-iam
description: "Operate IAM (Identity and Access Management) via bytedcli: query employee profiles by username, check IAM node permissions, and apply for RBAC roles on any PSM by creating an IAM exception ticket. Use when tasks mention IAM, employee lookup, user profile, identity management, IAM permission apply, RBAC role, or IAM exception ticket."
---

# bytedcli IAM (Identity and Access Management)

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

- 员工信息查询（`get-employee`）
- 查询当前用户在某个 PSM 上的 IAM 节点权限（`permission apply --check-only`）
- 通用申请 IAM 节点权限（`permission apply`）：直接提交「字节云IAM权限」工单，避免手写 curl 或开浏览器

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要登录 ByteCloud：`bytedcli auth login`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 查询员工信息
bytedcli iam get-employee demo.user

# 查询自己在某 PSM 上的某个权限是否放行 + 可申请角色
bytedcli iam permission apply \
  --permission demo.feature.access \
  --psm demo.service.api \
  --check-only

# 直接申请 IAM 节点权限（提交字节云 IAM 权限工单）
bytedcli iam permission apply \
  --permission demo.feature.access \
  --psm demo.service.api \
  --role demo.feature_viewer.cn \
  --reason "Need access for verification" \
  --source-url "https://example.bytedance.net/dashboard"

# JSON 格式输出（适合脚本管线消费工单 URL）
bytedcli --json iam permission apply \
  --permission demo.feature.access \
  --psm demo.service.api \
  --reason "CI access" \
  --yes
```

## `permission apply` 与 `api-test rpc-call --create-permission-ticket` 的关系

- `iam permission apply` 是**通用**入口，可申请任意 PSM 上的任意 IAM 节点权限，不依赖 RPC 调用响应。
- `api-test rpc-call --create-permission-ticket` 是**接口测试嵌入式**入口，仅用于：当 RPC 调用返回 `has_permission=false` 时，从 RPC 响应中提取 `escape_params` 并申请。
- 两者底层共享 `src/services/iam/permission.ts` 的工单创建逻辑；如果只是想给某个 PSM 拿权限，直接用 `iam permission apply` 更清晰。

## 主要参数（`permission apply`）

| 参数 | 说明 |
|---|---|
| `--permission <perm>`（必填） | IAM 权限编码，例如 `demo.feature.access` |
| `--psm <psm>`（必填） | 目标 PSM，例如 `demo.service.api` |
| `--reason <text>` | 工单理由；可选，省略时默认 `Need access for verification.` |
| `--role <roleId>` | 显式角色 ID；省略时使用 `/check/permission` 返回的推荐角色 |
| `--env <env>` | 默认 `prod` |
| `--region <region>` | 默认 `cn` |
| `--user-type <type>` | 默认 `person_account` |
| `--username <user>` | 默认使用当前登录用户 |
| `--source-url <url>` | 工单审计上下文 URL |
| `--platform <p>` | 工单平台字段，默认 `bits` |
| `--extra-params <kv...>` | 额外 escape_params；格式 `key=value`，可重复 |
| `--check-only` | 仅查询权限/角色，不开工单 |
| `--yes` | 非交互模式：直接采用推荐角色，不询问 |

## 返回字段

`get-employee`：

- `peopleId`：员工 ID
- `username`：用户名
- `displayName`：显示名称
- `email`：邮箱地址
- `idPhotoUrl`：证件照 URL

`permission apply`：

- `status`：`already_has`（已有权限，未开单）或 `created`（已开单）
- `permission` / `psm` / `role`
- `link` / `links`：开出的「字节云 IAM 权限」工单 URL，例如 `https://cloud.bytedance.net/cloud_ticket/apply/detail/<id>/drawer`
- `check`：底层 `/check/permission` 响应（含 `available_roles` / `default_role_id`）

## Notes

- 需要结构化输出加 `--json`（全局选项，放在子命令之前）
- IAM 使用 ByteCloud JWT 认证（与其他 ByteCloud 命令一致）
- `--check-only` 不会发起工单，只查询当前权限状态与可申请角色，安全可重复执行
- 自动化场景一定要带 `--yes` 或 `--role`，否则在非 TTY 环境会卡在角色确认

## References

- `references/iam.md`
