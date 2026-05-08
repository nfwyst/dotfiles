---
name: bytedance-megatron
description: "Operate Megatron (Spark app management) via bytedcli: get/search Spark app metadata, get queue usage, inspect queue quota. Use when tasks mention Megatron, Spark apps, Spark app metadata, queue usage, or user queue quota."
---

# bytedcli Megatron

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

- Megatron Spark 应用管理
- 查询或搜索 Spark 应用元数据
- 查询队列使用情况
- 查询队列默认配额、用户配额，或计算单个用户在队列中的资源上限
- 按全局 `--site` 路由，按 `--region` / 全局 `--vregion` 选择站点内虚拟区域

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# CN 站点：查询 Spark 应用元数据
bytedcli megatron app get --app-ids application_1234567890000_000001

# i18n-tt 站点：按虚拟区域查询多个应用
bytedcli --site i18n-tt megatron app get --app-ids application_1234567890000_000001,application-abc-123 -r sg

# 搜索应用
bytedcli --site i18n-tt megatron app search --app-name demo-app --state RUNNING -r va
bytedcli --site i18n-tt megatron app search --me -r sg

# 查询队列使用情况
bytedcli --site i18n-tt megatron queue get-usage --queue-name root.demo_queue -r sg

# 查询/计算队列配额
bytedcli --site i18n-tt megatron queue quota list-users --queue-name root.demo_queue -r sg
bytedcli --site i18n-tt megatron queue quota get-default --queue-name root.demo_queue -r sg
bytedcli --site i18n-tt megatron queue calc-user-quota --queue-name root.demo_queue --user-name demo-user -r sg
```

## Site and region

- 站点使用全局 `--site`：`cn`、`i18n-tt`、`eu-ttp`、`us-ttp`、`us-ttp-bdee`、`us-ttp-usts`、`boe`。
- `--region` 表示 Megatron 的虚拟区域，会作为 `x-bcgw-vregion` 请求头发送；也可用全局 `--vregion` 提供默认值。
- `cn`、`us-ttp`、`us-ttp-bdee`、`us-ttp-usts` 不需要 `--region`。
- `i18n-tt` 默认 `sg`，常用值包括 `sg`、`va`、`us-west`、`us_south_west`、`eu`、`id`、`mygp`。
- `eu-ttp` 默认 `i18n_gcp`，常用值包括 `eu_ttp`、`i18n_gcp_gp`、`i18n_gcp`、`eu_ttp_no`。
- `boe` 默认 `boe`，常用值包括 `boe`、`boei18n`。

## Notes

- 需要结构化输出加全局 `--json`
- `--app-ids` 支持逗号分隔或空格分隔的 application ID
- 若在生产网络访问 `i18n-tt`，可设置 `BYTEDCLI_NETWORK_PROFILE=prod`

## References

- `references/megatron.md`
- `references/invocation.md`
- `references/troubleshooting.md`
