---
name: bytedance-kylin
description: "Toutiao content moderation/audit system Kylin via bytedcli. Use when tasks mention 头条内容审核, Kylin, 审核历史/trace, review_context, gid 审核记录, 或需要用 bytedcli 查询某个 gid 的审核历史（支持可选 flow 过滤）。"
---

# bytedcli Kylin（头条内容审核）

本 skill 用于通过 bytedcli 查询 **某个 gid 的审核历史（trace）**。

- 文档示例一律使用 `demo-*` / `example.*` 占位值，不写真实线上信息。

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

- 需要按 gid 查询审核历史（trace），定位某条内容/任务的审核链路
- 需要用 `--flow` 过滤并保留下来“特征流程”的审核记录（按 Kylin 实际含义）
- 需要查询某个 flow 对应的策略 DSL（`kylin strategy dsl`）
- 需要在 Agent 场景下用 `--json` 获取机器可读输出

## Do not use

- 不要在文档里写任何真实线上域名、PSM、租户或工单 ID（请用 `example.*` / `demo-*` 占位）

## Quick start

```bash
# 查询某个 gid 的审核历史（可选按 flow 过滤）
bytedcli kylin trace list --gid demo-gid
bytedcli kylin trace list --gid demo-gid --flow demo-flow

# JSON 模式（机器可读）
bytedcli --json kylin trace list --gid demo-gid --flow demo-flow

# 查询某条 trace 的详情：
# 1) 从 `trace list` 输出中取某一条的 `Index` 对象
# 2) 直接作为 JSON 传给 `--index-json`（CLI 会自动做 JSON->base64 编码并请求 detail）
bytedcli kylin trace get --index-json '{"ItemID":"demo-gid","Flow":"demo-flow","Errno":0,"ReviewID":1,"ReviewSpanID":2,"SchedulerTaskID":3,"Timestamp":4,"FlowType":"machine","Guid":"demo-guid","LogID":"demo-logid","Env":"prod"}'
# 兼容别名：`bytedcli kylin trace detail ...`

# 获取某个 flow 的策略 DSL
bytedcli kylin strategy dsl --flow demo-flow
bytedcli kylin strategy dsl --flow demo-flow --ppe demo-ppe
```

## 输出约定

- 默认文本；`--json` 时只输出 JSON（全局参数，放在子命令前：`bytedcli --json kylin ...`）
- 所有示例值用占位符：`demo-*`、`sample-*`、`example.*`

## References

- `references/invocation.md`
- `references/kylin.md`
- `references/troubleshooting.md`
