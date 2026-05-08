---
name: bytedance-settings
description: "Operate ByteDance Settings via bytedcli: item/draft/review/deploy/whitelist/ut/var/biz commands. Use when tasks mention settings、配置、review、deploy、whitelist、UT、变量。"
---

# Settings (bytedcli)

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

- 需要执行 Settings 全流程能力（配置、草稿、审核、发布、白名单、UT、变量、biz）
- 需要通过 `--from` / `--query-json` / `--body-json` 透传请求体或筛选条件
- 需要批量维护 `app_settings` 客户端配置流程

## 前置条件

- 按通用调用方式执行命令（含内网 registry）：`references/invocation.md`
- 需要鉴权的命令先登录：`bytedcli auth login`

## 功能分组命令

> 说明：请求体/查询参数可通过 `--from`、`--query-json`、`--body-json` 原样透传；请按命令参数与 payload 字段约定构造 JSON。

```bash
# item / draft
bytedcli settings item get --item-id "123456"
bytedcli settings item create --id 1001 --item-name "sample_item" --brief "sample brief" --schema "{\"type\":\"integer\"}" --reviewers-json "[]"
bytedcli settings item create --id 1001 --item-name "sample_item" --brief "sample brief" --schema "1"
bytedcli settings item create --id 1001 --item-name "sample_item" --brief "sample brief" --schema "abc"
bytedcli settings item create --id 1001 --item-name "sample_item" --brief "sample brief" --schema "{}"
bytedcli settings item create --id 1001 --item-name "sample_item" --brief "sample brief" --schema "{\"s\":\"abc\"}"
bytedcli settings item create --id 1001 --item-name "sample_item" --brief "sample brief" --scheme "{}"
bytedcli settings draft save --item-id "123456" --code "return true" --draft-type 1 --next-step 1

# review / deploy
bytedcli settings review list --item-id "123456"
bytedcli settings deploy list --item-id 123456 --page 1 --page-size 10

# whitelist
bytedcli settings whitelist add --item-id "123" --title "demo" --whitelist "u1" --whitelist "u2"
bytedcli settings whitelist list --item-id "123" --page-size 10 --page 1 --status 0 --type 0 --keyword ""
bytedcli settings whitelist biz-get --whitelist-id 1001

# ut / var / biz
bytedcli settings ut list --item-id 123456 --ut-status 0
bytedcli settings var list-item --item-id 123456
bytedcli settings biz search-id --appid "1001"
```

## Notes

- 需要结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json settings review list --item-id "123"`）
- 大多数 `settings` 子命令支持 `--from <path>` / `--query-json` / `--body-json` 组合透传
- `settings item create --schema/--scheme` 支持 schema JSON 或示例值自动推断类型（`1 -> integer`，`abc -> string`，`{} -> 宽松 object`，`{"s":"abc"} -> 严格 object schema`）
- `settings item apply` 作为兼容别名保留，推荐使用 `settings item create`
- 分页命令优先使用 `--page`（1-based）；`--page-no` 仅兼容旧用法

## References

- `references/settings.md`
- `references/invocation.md`
- `references/review-create.sample.json`
- `references/review-create-open.sample.json`
