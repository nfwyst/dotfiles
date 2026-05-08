---
name: bytedance-oneservice
description: "Get OneService query metadata, resolve current ONLINE query versions, inspect version detail, and fetch SQL text via bytedcli. Use when tasks mention OneService, invoker_server, query metadata, query versions, version IDs, or retrieving SQL for a OneService API/query."
---

# bytedcli OneService

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

- Get OneService query metadata by query id
- Resolve query versions from a query id
- Get detailed query version payloads by version id
- Fetch SQL text for the current ONLINE OneService query version
- Inspect `invoker_server` query / query_version APIs through bytedcli instead of manual curl

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 必须先有可用的 SSO browser session：`bytedcli auth login --session`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Authentication

OneService 走所选站点的浏览器会话鉴权，只接受 session cookie；仅有 ByteCloud JWT 不够。默认 `cn` 使用国内 OneService 端点；`--site i18n-tt` 使用 i18n-tt OneService 端点。

执行任何 OneService 命令前，先确保已完成：

```bash
bytedcli auth login --session
bytedcli --site i18n-tt auth login --session
```

如果没有可用 session，命令会返回 `ONESERVICE_AUTH_ERROR`，并提示重新登录。

## Quick start

```bash
# 先登录，建立目标站点的可用 session
bytedcli auth login --session
bytedcli --site i18n-tt auth login --session

# 查询 OneService query 元信息（输入 queryId）
bytedcli oneservice meta get --id 7540220100792550450

# 查询指定 query version 的完整详情（输入 versionId）
bytedcli oneservice detail get --id 7543499614608016410

# 直接按 queryId 获取当前 ONLINE 版本的 SQL
bytedcli oneservice sql get --id 7626253820271625242
```

## Notes

- 使用 `--json` 获取结构化输出
- `oneservice meta get --id <queryId>` 调用 `/invoker_server/api/v1/query/?id=<queryId>`
- `oneservice detail get --id <versionId>` 调用 `/invoker_server/api/v1/query_version/<versionId>`
- `oneservice sql get --id <queryId>` 会先调用 `/invoker_server/api/v1/query_version/list?queryId=<queryId>` 解析当前带 `ONLINE` 状态的 `versionId`，再查询 version detail 并提取 `version.param_info.sqlText`
- `meta` 的输入是 queryId；`detail` 的输入是 versionId；`sql` 的输入是 queryId，不要混用
- 如果某个 query 没有 `ONLINE` 版本，`sql` 会返回 `ONESERVICE_VERSION_MISSING`
- 如果 version detail 里没有 `version.param_info.sqlText`，`sql` 会返回 `ONESERVICE_SQL_MISSING`

## References

- `references/oneservice.md`
- `references/invocation.md`
- `references/troubleshooting.md`
