---
name: bytedance-spark-platform
description: "Operate Spark Platform via bytedcli: list spaces, list/get/create links, summarize deployConfig schema, and manage link env entries. Use when tasks mention Spark Platform (i18n-tt)."
---

# bytedcli Spark Platform

## 如何调用 bytedcli

先选择一种调用方式。下面所有示例默认直接写 `bytedcli`。

```bash
# 方式 1：直接用 npx 运行最新版
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]

# 方式 2：先全局安装，再直接调用 bytedcli
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli <command> [options]
```

## When to use

- Spark Platform space/link 查询
- 想把 link 的 deployConfig 做摘要（解析 schemaUrl、bundle、bundlePath、动态参数、条件摘要）
- 管理 link env（list/set/delete），写操作先 `--dry-run` 预览 payload

## Quick start

```bash
# 查看命令帮助
bytedcli spark-platform --help

# Space
bytedcli spark-platform space list --name "Search" --tag "search"

# Link
bytedcli spark-platform link list --space-id "space_demo" --page 1 --page-size 10
bytedcli spark-platform link get --link-key "demo_link"

# 单 link summary：默认仅返回 in-effect 版本 + 聚合 pageConfigs（含 sourceVersion）
bytedcli spark-platform link summary --link-key "demo_link"

# 想看全部历史版本（按 in-effect 优先 / updatedAt / version 倒序）
bytedcli --json spark-platform link summary --link-key "demo_link" --include-history

# 批量 summary：并行拉多条 link，单条失败不影响其他条目
bytedcli --json spark-platform link summary --link-keys "demo_link_a,demo_link_b,demo_link_c"

# Env
bytedcli spark-platform link env list --link-key "demo_link" --app-id 22
bytedcli spark-platform link env set --link-key "demo_link" --env "ppe_demo" --deploy-config-file ./deploy-config.json --dry-run
bytedcli spark-platform link env delete --link-key "demo_link" --env "ppe_demo" --dry-run
```

## Notes

- Spark Platform 当前固定为 i18n-tt（host: `spark-platform.tiktok-row.net`），无需传 `--site`
- 全局 `--json` 放在 domain 前：`bytedcli --json spark-platform ...`
- `link summary` 默认只关心当前在生效的版本，输出体积小：
  - `publishedVersion`：主发布版本（in-effect 优先；无 in-effect 时回退到最新发布版本）
  - `publishedVersions`：默认仅包含当前 in-effect 的 Libra 版本（多 in-effect 全部返回，覆盖典型 AB 分发场景；无 in-effect 时退化为最新一条 fallback），每条带 `inEffect: boolean` 字段
  - 想看完整历史发布列表时加 `--include-history`，会输出全部已发布版本（按 in-effect 优先 / updatedAt / version 倒序）
  - `schema.pageConfigs`：聚合 in-effect 版本下的全部 pageConfig，每条带 `sourceVersion` 标识版本归属
- `schema.pageConfigs` 支持的多 pageConfig 形态（可能在同一份输出里同时出现）：
  - 多个 in-effect Libra 版本同时生效（跨版本 AB）
  - 同一版本 deployConfig 内的 `realtimeDeployConfig[]` AB 变体（同版本内 AB），每个变体的 `conditionSummary` 会同时包含父级条件（如 `app_id == [...]`）和 AB 实验条件（如 `csi_enable_new_analysis == ["1"]`），调用方据此判断命中条件
  - 嵌套 `configs: [...]` 分支（按 device_platform / version_code 等分流）
- `link summary` / `link get` 单次调用默认 60s timeout，并对 5xx / timeout / 网络抖动自动重试 2 次（间隔 1s/2s 指数退避），调用方外层最好预留 ≥ 90s 超时
- `--json` 输出的 `error.code` 已细分：
  - `SPARK_PLATFORM_TIMEOUT`：单次调用超时（建议外层重试）
  - `SPARK_PLATFORM_SERVER_ERROR`：上游 5xx（建议外层重试）
  - `SPARK_PLATFORM_NETWORK_ERROR`：网络层异常（建议外层重试）
  - `SPARK_PLATFORM_NOT_FOUND`：linkKey/spaceId 不存在（不要重试）
  - `SPARK_PLATFORM_PERMISSION_DENIED`：未登录或无权访问（先 `bytedcli auth status`）
  - `SPARK_PLATFORM_ERROR` / `SPARK_PLATFORM_INVALID_RESPONSE` / `SPARK_PLATFORM_INPUT_ERROR` / `SPARK_PLATFORM_AUTH_ERROR`：其他业务/参数/响应/鉴权类错误
