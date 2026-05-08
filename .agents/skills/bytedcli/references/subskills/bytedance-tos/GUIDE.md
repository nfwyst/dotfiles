---
name: bytedance-tos
description: "Operate TOS (ByteDance object storage) via bytedcli: list buckets, view user info, view user records, and discover supported sites/VRegions. Use when tasks mention TOS or object storage."
---

# bytedcli TOS

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

- TOS 控制台能力（Bucket 列表、收藏 Bucket、申请/审批记录）
- 需要查询 TOS 支持的站点与 VRegion（best-effort，带 1 天缓存）

## 前置条件

- 使用通用调用方式：`references/invocation.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 站点与 VRegion 自动发现（best-effort）
bytedcli tos list-sites

# 当前用户信息
bytedcli tos get-user-info

# 收藏的 bucket
bytedcli tos list-starred-buckets --page 1 --size 5

# 可访问的 bucket
bytedcli tos list-viewable-buckets --page 1 --size 5

# 申请记录（apply/toaudit）
bytedcli tos list-records --status apply --record-type 1 --page 1 --size 5
bytedcli tos list-records --status toaudit --page 1 --size 5

# BOE
bytedcli --site boe tos list-starred-buckets --page 1 --size 5
# i18n
bytedcli --site i18n-bd tos list-starred-buckets --page 1 --size 5
```

## Notes

- `user-info` has been renamed to `get-user-info`; the old name still works as a hidden alias
- 默认文本模式；结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json tos list-starred-buckets ...`）
- 环境切换使用 `--site`（或 `BYTEDCLI_CLOUD_SITE`）

## References

- `references/tos.md`
