# Chronos

```bash
# List namespaces
bytedcli chronos namespace list --namespace-tab ALL
bytedcli --site boe chronos namespace list --namespace-tab MY --name demo-namespace --page 2 --page-size 50

# List tasks under a namespace
bytedcli chronos task list --namespace-id demo-namespace --task-tab ALL --task-type GENERAL
bytedcli --site boe chronos task list --namespace-id demo-namespace --task-tab MY --task-type DYNAMIC_TREE --name demo-task --page 2 --page-size 20

# Get task detail
bytedcli chronos task get --task-id demo-task
bytedcli --site boe chronos task get --task-id demo-task

# Update a task safely
bytedcli chronos task update --task-id demo-task --owner demo-user
bytedcli --site boe chronos task update --task-id demo-task --namespace-id demo-namespace --alarm-switch true --alarm-people demo-user-a,demo-user-b --alarm-group demo-group

# JSON output
bytedcli --json chronos namespace list --namespace-tab MY_FOLLOW
bytedcli --json chronos task list --namespace-id demo-namespace --task-tab MY_FOLLOW --task-type GENERAL
bytedcli --json --site boe chronos task get --task-id demo-task
```

## Command surface

- `chronos namespace list`
  - 支持分页获取命名空间
  - 关键参数：`--namespace-tab`、`--name`、`--page`、`--page-size`
- `chronos task list`
  - 按 `namespace_id` 分页获取任务列表
  - 关键参数：`--namespace-id`、`--task-tab`、`--task-type`、`--name`
- `chronos task get`
  - 按 `task_id` 获取任务详情
  - 必填参数：`--task-id`
- `chronos task update`
  - 按 `task_id` 安全更新任务
  - 只允许更新：`owner`、`alarm_switch`、`alarm_people`、`alarm_group`
  - `--owner` 支持逗号分隔多值
  - `--alarm-people` 支持逗号分隔多值
  - `--alarm-group` 只允许单值
  - 可选参数：`--namespace-id`

## Output highlights

- `chronos namespace list`
  - 命名空间 ID
  - 名称
  - owner / creator
- `chronos task list`
  - task ID
  - task 名称
  - owner
  - namespace
- `chronos task get`
  - HTTP 调度链接
  - HTTP Method
  - 报警接收人
  - 报警组
  - 监控链接
- `chronos task update`
  - 更新后返回最终任务详情
  - 输出本次真正修改的字段和权限校验结果
- `--json` 输出会携带后端 `header`，并返回补齐后的 namespace/task/detail 字段；`task get` 额外包含 `executor`、`sharding`、`alarm_list`、`extra`，默认不返回 `raw`

## Notes

- 当前站点只支持 `cn` 与 `boe`
- `chronos namespace list --namespace-tab` 支持 `ALL`、`MY`、`MY_FOLLOW`，默认 `ALL`
- `chronos task list --task-tab` 支持 `ALL`、`MY`、`MY_FOLLOW`，默认 `ALL`
- `chronos task list --task-type` 支持 `UNKNOWN`、`GENERAL`、`DYNAMIC_TREE`，默认 `GENERAL`
- `chronos namespace list` 与 `chronos task list` 未显式传分页参数时，默认使用 `page=1`、`page_size=20`
- `chronos task get` 文本模式展示关键字段，`--json` 返回结构化字段且默认不暴露 `raw`
- `chronos task update` 会先调用 `task get` 和 `namespace list --namespace-tab MY`，确认当前账号对 namespace 有编辑权限后再发 PUT
- `chronos task update` 的入参会从 `task get` 的原始返回全量回填，只覆盖允许修改的字段，避免 overwrite 接口覆盖其它配置
- `chronos task update` 不支持更新 `switch`
- `chronos task update --alarm-group` 不能传逗号分隔的多个群；若需要切群，只保留一个目标群值
- 若先前在其他站点已登录，不代表 `boe` 一定已登录；切换到 `boe` 后优先执行 `bytedcli --site boe auth status`
