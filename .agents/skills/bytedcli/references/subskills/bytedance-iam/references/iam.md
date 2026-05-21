# IAM (Identity and Access Management)

## 员工信息查询

```bash
# 查询员工信息
bytedcli iam get-employee <username>

# JSON 格式输出
bytedcli --json iam get-employee <username>
```

### 返回字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `peopleId` | number | 员工 ID |
| `username` | string | 用户名 |
| `displayName` | string | 显示名称 |
| `email` | string | 邮箱地址 |
| `idPhotoUrl` | string | 证件照 URL |

## IAM 节点权限申请

```bash
# 仅检查权限和可申请角色
bytedcli iam permission apply \
  --permission <perm> \
  --psm <psm> \
  --check-only

# 申请 IAM 节点权限
bytedcli iam permission apply \
  --permission <perm> \
  --psm <psm> \
  --role <roleId> \
  --reason "<text>" \
  --source-url "<url>"
```

### 主要参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `--permission` | 是 | IAM 权限编码 |
| `--psm` | 是 | 目标 PSM |
| `--reason` | 否 | 工单理由；省略时默认 `Need access for verification.` |
| `--role` | 否 | 角色 ID；省略走推荐角色 |
| `--env` | 否 | 默认 `prod` |
| `--region` | 否 | 默认 `cn` |
| `--user-type` | 否 | 默认 `person_account` |
| `--username` | 否 | 默认当前登录用户 |
| `--source-url` | 否 | 工单审计上下文 URL |
| `--platform` | 否 | 工单平台字段，默认 `bits` |
| `--extra-params` | 否 | 额外 escape_params，`key=value` 可重复 |
| `--check-only` | 否 | 仅查询，不开单 |
| `--yes` | 否 | 非交互模式，直接采用推荐角色 |

### 返回字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | string | `already_has`（已有权限）或 `created`（已开单） |
| `permission` | string | 权限编码 |
| `psm` | string | 目标 PSM |
| `role` | string \| null | 实际申请的角色 ID |
| `link` | string \| null | 「字节云 IAM 权限」工单 URL |
| `links` | string[] | 工单 URL 列表 |
| `check` | object | `/check/permission` 原始解析（含 `available_roles` / `default_role_id`） |

### 与 `api-test rpc-call --create-permission-ticket` 的区别

- 本命令是通用入口：任意 PSM、任意权限都可申请。
- `api-test rpc-call --create-permission-ticket` 仅在 RPC 调用返回 `has_permission=false` 时复用 RPC 响应里的 `escape_params` 申请权限，绑定接口测试场景。
- 两者共享 `src/services/iam/permission.ts` 内部实现，工单形态一致。
