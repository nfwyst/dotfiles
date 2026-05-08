---
name: bytedance-dkms
description: "Operate DKMS (Data Key Management Service) via bytedcli: get data key info, list/check/add permissions for TikTok ROW and BOE-I18N regions. Use when tasks mention DKMS, data key, encryption key permissions, or TikTok data encryption."
---

# bytedcli DKMS (Data Key Management Service)

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

- 数据密钥查询（get-key）
- 密钥权限列表（list-permissions）
- 权限检查（check-permission）
- 权限添加（add-permission）
- TikTok ROW（VA/SG/EU）或 BOE-I18N 区域的数据加密密钥管理

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- DKMS 需要按区域切换站点：
  - TikTok ROW 区域（VA/SG/EU）使用 `--site i18n-tt`，需单独登录
  - BOE-I18N 区域执行命令时使用 `--site boe`（vregion US-BOE）；认证通常可复用 `cn/i18n-bd` 的登录态，如失效再补一次对应站点的 `auth login`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 获取密钥信息
bytedcli --site i18n-tt dkms get-key my-data-key --region va

# 列出密钥权限
bytedcli --site i18n-tt dkms list-permissions my-data-key --region va

# 检查权限
bytedcli --site i18n-tt dkms check-permission my-data-key --entity-name my.service.psm --entity-type service --region va

# 添加权限（服务）
bytedcli --site i18n-tt dkms add-permission my-data-key --entity-name my.service.psm --entity-type service --region va

# 添加权限（员工）
bytedcli --site i18n-tt dkms add-permission my-data-key --entity-name demo.user --entity-type employee --region va
```

## 区域路由

| 区域 | API 域名 | 命令站点 |
|------|----------|----------|
| VA (US) | `dkms-va.tiktok-row.org` | `i18n-tt` |
| SG | `dkms-sg.tiktok-row.org` | `i18n-tt` |
| EU | `dkms-euttp.tiktok-eu.org` | `i18n-tt` |
| BOE-I18N | `dkms-boei18n.byted.org` | `boe`（vregion US-BOE；`boei18n` 为别名） |

## Notes

- 需要结构化输出加 `--json`（全局选项，放在子命令之前）
- 区域参数 `--region` 支持：`va`, `sg`, `eu`, `boei18n`（`boei18n` 映射到 `boe` 站点 + vregion US-BOE）

## References

- `references/dkms.md`
