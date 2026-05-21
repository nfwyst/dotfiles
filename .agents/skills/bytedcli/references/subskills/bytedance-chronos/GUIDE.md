---
name: bytedance-chronos
description: "Operate Chronos via bytedcli: list namespaces, list tasks by namespace, and get task details including HTTP scheduling URL and alarm receivers. Use when tasks mention Chronos, 调度任务, namespace, task_id, HTTP 调度链接, 报警接收人, or need CN/BOE Chronos lookup. Make sure to use this skill whenever the user wants Chronos command guidance or agent routing, even if they only mention scheduler/task detail without saying 'Chronos'."
---

# Chronos (bytedcli)

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

- 分页列出 Chronos 命名空间
- 按 `namespace_id` 查询任务列表
- 按 `task_id` 查询任务详情
- 安全更新任务 owner、开关和基础报警配置
- 获取 HTTP 调度链接、HTTP Method、报警接收人、报警组、监控链接
- 在 `cn` / `boe` 之间切换 Chronos 站点并确认认证状态

## 前置条件

- 按通用调用方式执行命令（含内网 registry）：`references/invocation.md`
- 需要鉴权的命令先登录：`bytedcli auth login`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

Current Chronos commands are grouped under `chronos namespace` and `chronos task`.

```bash
bytedcli chronos namespace list --namespace-tab ALL
bytedcli --site boe chronos namespace list --namespace-tab MY --name demo-namespace --page 2 --page-size 50

bytedcli chronos task list --namespace-id demo-namespace --task-tab ALL --task-type GENERAL
bytedcli --site boe chronos task list --namespace-id demo-namespace --task-tab MY --task-type DYNAMIC_TREE --name demo-task --page 2 --page-size 20

bytedcli chronos task get --task-id demo-task
bytedcli --site boe chronos task get --task-id demo-task

bytedcli chronos task update --task-id demo-task --owner demo-user
bytedcli --site boe chronos task update --task-id demo-task --namespace-id demo-namespace --alarm-switch true --alarm-people demo-user-a,demo-user-b --alarm-group demo-group

# machine-readable output
bytedcli --json chronos namespace list --namespace-tab MY_FOLLOW
bytedcli --json --site boe chronos task get --task-id demo-task
```

## Notes

- `--json` 是全局参数，必须放在子命令前，例如 `bytedcli --json chronos task get --task-id demo-task`
- `chronos namespace list` 会始终带 `--namespace-tab` 语义；可选值为 `ALL`、`MY`、`MY_FOLLOW`，默认 `ALL`
- `chronos namespace list --name <name>` 可按 namespace 名称过滤
- `chronos namespace list` 与 `chronos task list` 未显式传分页参数时，默认 `--page 1 --page-size 20`
- 任务列表查询必须显式传 `--namespace-id`
- `chronos task list --task-tab` 支持 `ALL`、`MY`、`MY_FOLLOW`，默认 `ALL`
- `chronos task list --task-type` 支持 `UNKNOWN`、`GENERAL`、`DYNAMIC_TREE`，默认 `GENERAL`
- `chronos task list --name <name>` 可按 task 名称过滤
- `--json` 输出会携带后端 `header`，并返回更完整的 namespace/task/detail 字段；`chronos task get` 额外包含 `executor`、`sharding`、`alarm_list`、`extra`，默认不返回 `raw`
- 任务详情查询必须显式传 `--task-id`
- 当前站点只支持 `cn` 与 `boe`
- `chronos task get` 的文本输出会聚焦关键字段；默认 JSON 也不暴露 `raw`
- `chronos task update` 只允许更新 `owner`、`alarm_switch`、`alarm_people`、`alarm_group`
- `chronos task update --owner` 支持逗号分隔的多人，例如 `demo-user-a,demo-user-b`
- `chronos task update --alarm-people` 支持逗号分隔的多人，例如 `demo-user-a,demo-user-b`
- `chronos task update --alarm-group` 只允许单值，不能传逗号分隔的多个群
- `chronos task update` 不支持更新 `switch`；若任务开关未生效，不要继续重试同一个 PUT 参数
- `chronos task update` 会先调用 `task get` 读取当前任务，再调用 `namespace list --namespace-tab MY` 校验当前账号是否对所属 namespace 有编辑权限
- `chronos task update` 发给后端的 PUT 请求体是从 `task get` 原始返回全量回填后再只覆盖允许字段，避免 overwrite 接口覆盖其它配置
- 遇到 `Not authenticated` / `AUTH_REQUIRED` 时，先为目标站点执行登录，再重试原命令

## References

- `references/invocation.md`
- `references/chronos.md`
- `references/troubleshooting.md`
