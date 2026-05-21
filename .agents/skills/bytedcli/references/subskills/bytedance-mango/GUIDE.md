---
name: bytedance-mango
description: "通过 bytedcli 操作芒果平台任务与接口录入能力。用户提到 Mango、芒果、芒果任务查询、任务创建、接口查询、接口录入、接口修改、接口删除、空间、应用、GraphQL 规则时使用。"
---

# bytedcli 芒果平台

使用 `bytedcli mango` 管理芒果平台任务和任务下的接口。执行芒果业务命令前，先准备 SSO browser session。查询任务时所有过滤参数都可选；操作具体任务或接口时再显式传入空间、模块和任务 ID。

`mango` 使用 `auth login --session` 保存的 SSO browser session 按需获取 open-admin cookie，不保存默认空间、默认应用或默认任务。

## 命令速查

需要稳定结构化输出时，把全局参数 `--json` 放在 `mango` 前面。

| 分类   | 命令                                       | 用途                                           |
| ------ | ------------------------------------------ | ---------------------------------------------- |
| 登录态 | `auth login --session`                     | 准备 Mango 请求需要的 SSO browser session。    |
| 空间   | `mango space list`                         | 查看可用空间 ID，用于后续 `--space-id`。       |
| 应用   | `mango app list --space-id <id>`           | 查看空间下应用，获取 `Module` 和 AGW PSM。     |
| 模块   | `mango module graphql-rule list`           | 查看指定模块默认会注入的 GraphQL 规则。        |
| 任务   | `mango task list/create/trigger-pipeline`  | 查询、创建任务，或触发任务流水线重跑。         |
| 菜单   | `mango task menu list`                     | 查询任务可选菜单；资源由添加接口流程默认选择。 |
| 接口   | `mango task method list/add/update/delete` | 查询、录入、修改或删除任务下的接口。           |

## 推荐流程

1. 先准备登录态和当前用户名。Mango 业务请求会自动用 SSO browser session 获取 open-admin cookie。

```bash
bytedcli auth login --session
bytedcli auth userinfo
```

2. 查询任务。查询任务的参数都不是必传；如果用户给了 PPE/BOE 泳道，优先只用 `--env` 查询，再从返回结果里读取 `space_id`、`module` 和任务 ID。

```bash
bytedcli mango task list --env ppe_demo
```

3. 如果还不知道空间或模块，再查询空间和应用，确定后续命令使用的 `--space-id`、`--module` 和应用 AGW PSM。

```bash
bytedcli mango space list
bytedcli mango app list --space-id 6
```

4. 创建任务时需要显式传空间和模块；已有任务从 `task list` 结果拿任务 ID。

```bash
bytedcli mango task list --space-id 6 --module demo_module --name demo-task
bytedcli mango task create --space-id 6 --module demo_module --name demo-task --boe boe_demo --ppe ppe_demo
```

5. 如果接口需要关联菜单，先查询任务下可选菜单。默认文本输出会直接说明是否已绑定菜单；如果提示“当前任务已绑定菜单”且“可以直接添加接口”，`mango task method add` 可以不传 `MenuItems` / `MethodResources`，CLI 会默认使用绑定菜单并自动选择默认资源。AI 开放平台会展示预设 `Scope` 菜单；默认 scope 可直接添加接口，想换菜单时把表格里的 `Scope` 传给 `--menu-scope`。需要机器读取时再加 `--json`，其中 `method_menu_item` 可直接放入 `--methods` 的 `MenuItems`。

```bash
bytedcli mango task menu list --space-id 6 --module demo_module --task-id 4238
```

6. 操作任务下接口。

```bash
bytedcli mango task method list --space-id 6 --module demo_module --task-id 4238
bytedcli mango task method add --space-id 6 --module demo_module --task-id 4238 --methods '[{"Name":"demo-method"}]'
```

## 使用规则

- Mango 业务请求会用 `auth login --session` 的 SSO browser session 自动获取 open-admin cookie。
- `mango task list` 的 `--space-id`、`--module`、`--name`、`--env` 都是可选过滤条件；已知泳道时优先用 `--env` 查询。
- 其他任务和接口操作需要的 `--space-id` 来自 `mango task list` 结果或 `mango space list`。
- 其他任务和接口操作需要的 `--module` 来自 `mango task list` 结果或 `mango app list --space-id <id>` 输出中的 `Module`。
- 所有任务 ID 都使用 `--task-id <task-id>`。
- 录入接口时，如果 `--methods` JSON 里传了 `Psm` 和下游方法，并且希望复用已有路由配置，传 `--agw-psm <psm>`。

## 按需阅读

| 任务场景                                           | 参考文件                                            |
| -------------------------------------------------- | --------------------------------------------------- |
| 通用执行、JSON 输出、HTTP 调试                     | [invocation.md](references/invocation.md)           |
| 登录态与显式上下文                                 | [auth-state.md](references/auth-state.md)           |
| 模块 GraphQL 默认规则                              | [module.md](references/module.md)                   |
| 任务查询、创建、流水线                             | [task.md](references/task.md)                       |
| 任务接口查询、录入、修改、删除、接口类型和字段说明 | [method.md](references/method.md)                   |
| 常见错误与处理                                     | [troubleshooting.md](references/troubleshooting.md) |
