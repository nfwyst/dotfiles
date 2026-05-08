---
name: bytedance-kmsv2
description: "Operate KMS v2 (Key Management Service v2) via bytedcli: manage keyrings, customer keys, and permissions for TikTok ROW and BOE-I18N regions. Use when tasks mention KMS v2, keyring, customer key, encryption key ACL, or Security Platform authentication."
---

# bytedcli KMS v2 (Key Management Service v2)

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

- 密钥环查询（get-keyring）
- 客户密钥列表（list-keys）
- 客户密钥详情（get-key）
- 密钥权限管理（add-permission）
- TikTok ROW（VA/SG）或 BOE-I18N 区域的 KMS v2 密钥管理

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要安装 Chrome/Chromium 和 puppeteer（`npm install -g puppeteer`）
- KMS v2 使用 Security Platform JWT（bs-token）认证，**与 ByteCloud SSO 不同**
- 首次使用会自动打开浏览器，通过 CDP 捕获登录后的 bs-token
- Token 缓存 55 分钟，过期后自动重新触发浏览器登录

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 获取密钥环信息
bytedcli kmsv2 get-keyring demo.privacy.test --region va

# 列出命名空间下的客户密钥
bytedcli kmsv2 list-keys demo.privacy.test --region va

# 获取客户密钥详情
bytedcli kmsv2 get-key demo.privacy.test --key-name default --region va

# 添加服务权限（通过 PSM）
bytedcli kmsv2 add-permission demo.privacy.test --key-name default --services my.service.psm --region va

# 添加用户权限
bytedcli kmsv2 add-permission demo.privacy.test --key-name default --users demo.user bob --region va

# 同时添加服务和用户权限
bytedcli kmsv2 add-permission demo.privacy.test --key-name default --services svc1 svc2 --users demo.user --region va
```

## 区域路由

| 区域 | API 域名 | Security Platform |
|------|----------|-------------------|
| VA (US) | `prod-row-kmsv2-control-og.tiktok-row.org` | `security.tiktok-row.net` |
| SG | `prod-row-kmsv2-control-sg.tiktok-row.org` | `security.tiktok-row.net` |
| BOE-I18N | `boei18n-kmsv2-control.byted.org` | `security-boe-i18n.bytedance.net` |

## Notes

- 需要结构化输出加 `--json`（全局选项，放在子命令之前）
- `add-permission` 是增量操作，会与现有权限合并，不会覆盖
- 服务 PSM 会自动转换为 SPIFFE URI 格式

> ⚠️ **警告**：`add-permission` 命令采用 read-modify-write 模式，不支持并发安全。请勿在高频场景或多人同时操作时使用，以避免竞态条件导致权限丢失。

## References

- `references/kmsv2.md`
