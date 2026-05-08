---
name: bytedance-dolphin
description: "Query Dolphin (dynamic decision platform) via bytedcli: events, rule groups, rules, feature env rules, and testcases. Use when tasks mention Dolphin, event_id/group_id/rule_id, rule group history, feature env, or check_testcases."
---

# bytedcli Dolphin（动态决策平台）

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

- 查询 Dolphin 的 **事件（event）**、**规则组（group）**、**规则（rule）**
- 需要查看某个 **feature env** 下的规则组规则（环境差异）
- 需要列出测试用例或执行 `check_testcases` 并拿到结构化结果

## 前置条件

- 使用通用调用方式：`references/invocation.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

Commands are grouped under `dolphin event`, `dolphin group`, and `dolphin rule`. Within `event` and `group`, subcommands follow the `<resource> <verb>` pattern (e.g. `event group list`, `event var list`, `group factor list`). Old flat names (e.g. `dolphin event groups`, `dolphin event vars`, `dolphin event params`, `dolphin group factors`, `dolphin group testcases`) still work as hidden aliases.

```bash
# 事件元信息
bytedcli dolphin event get --event-id 12345

# 事件下规则组列表
bytedcli dolphin event group list --event-id 12345 --page-size 10

# 事件变量列表
bytedcli dolphin event var list --event-id 12345

# 事件参数列表
bytedcli dolphin event param list --event-id 12345

# 查询规则组详情（可选带 rules/testcases/template）
bytedcli dolphin group get --group-id 67890 --with-rules --with-testcases

# 查询 feature env 下的规则组规则
bytedcli dolphin group feature-env get --group-id 67890 --env-name demo_env

# 规则组 factor 列表
bytedcli dolphin group factor list --group-id 67890

# 列出 event 级测试用例（scope=1）
bytedcli dolphin group testcase list --event-id 12345 --bizline-id 1 --scope 1

# 执行 check_testcases（body 较复杂，推荐用 --body-file）
bytedcli dolphin event testcases check --body '{"bizline_id":1,"event_id":12345,"test_case_id":10001}'
```

## Notes

- 默认输出文本表格；需要机器可读输出时加全局 `--json`（必须放在 `dolphin` 前面）。
- `--env` 仅用于 Dolphin 模块（`prod|boe`），不等同于 bytedcli 的全局 `--site`。
- `check_testcases` 入参建议用 `--body-file`，避免命令行转义问题。

## References

- `references/dolphin.md`
- `references/invocation.md`
- `references/troubleshooting.md`
