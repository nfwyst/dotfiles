---
name: bytedance-iam
description: "Operate IAM (Identity and Access Management) via bytedcli: query employee profiles by username. Use when tasks mention IAM, employee lookup, user profile, or identity management."
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

- 员工信息查询（get-employee）
- 根据用户名获取员工档案

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要登录 ByteCloud：`bytedcli auth login`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 查询员工信息
bytedcli iam get-employee demo.user

# JSON 格式输出
bytedcli --json iam get-employee demo.user
```

## 返回字段

- `peopleId`：员工 ID
- `username`：用户名
- `displayName`：显示名称
- `email`：邮箱地址
- `idPhotoUrl`：证件照 URL

## Notes

- 需要结构化输出加 `--json`（全局选项，放在子命令之前）
- IAM 使用 ByteCloud JWT 认证（与其他 ByteCloud 命令一致）

## References

- `references/iam.md`
