---
name: bytedance-bes
description: "Submit BES metadata modification workflows through bytedcli. Use when tasks mention BES 元信息、BES 工单、workflow_config_id=1491、或需要把一段 config JSON 提交成 BES 修改元信息工单。"
---

# BES（bytedcli）

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

- 需要提交 BES 元信息修改工单。
- 已知要走 BPM 底层建单，但业务上只允许固定流程 `workflow_config_id=1491`。
- 用户已经提供或可以整理出最终 `config` JSON。
- 需要结构化返回 `record_id` 供后续追踪或回填。

如果任务是：

- 查询、评论、推进、取消通用 BPM 工单，请使用 `bytedance-bpm`。
- 提交 RDS / DBW 数据库变更工单，请使用 `bytedance-rds`。

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要先登录：`bytedcli auth login`
- 如目标站点需要浏览器态会话，可先执行：`bytedcli auth login --session`

## Quick start

```bash
# 文本模式提交
bytedcli bes metadata update --config '{"title":"demo-ticket"}'

# JSON 模式提交，便于 agent / 脚本消费
bytedcli --json bes metadata update --config '{"title":"demo-ticket","field":"value"}'

# 切站点提交（实际走全局 --site）
bytedcli --site boe --json bes metadata update --config '{"title":"demo-ticket"}'
```

## Commands

### `bes metadata update`

```bash
bytedcli bes metadata update --config <json-object>
```

常用参数：

- `--config <json-object>`：必填，BES 工单配置 JSON，必须是对象，不能是数组或普通字符串。
- `--json`：建议脚本或 agent 默认使用，返回结构化 `record_id` 与 `workflow_config_id`。
- `--site <site>`：使用全局站点切换请求环境，例如 `cn` / `boe` / `i18n-tt`。

固定行为：

- 内部固定调用 BPM 建单接口。
- `workflow_config_id` 固定为 `1491`，命令行不暴露覆盖参数。
- 默认复用当前全局 `--site` 对应的 BPM / JWT / Origin 站点。

输出：

- `--json`：返回 `record_id` 与 `workflow_config_id`。
- 非 `--json`：输出 BES 工单创建摘要表。

## Notes

- `--config` 必须是合法 JSON 对象；推荐在 shell 中使用单引号包裹整段 JSON。
- 如果 JSON 很长，先在本地整理后再粘贴，避免 shell 转义问题。
- 站点切换通过全局 `--site` 控制，不使用独立的 `--bpm-site`。
- 当前 BES 命令只支持“提交修改元信息工单”这一种能力。

## References

- `references/invocation.md`
- `references/troubleshooting.md`
