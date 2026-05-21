# Starfish Commands

## Authentication

```bash
bytedcli starfish login
bytedcli starfish login --cookie "session=xxx"
export STARFISH_COOKIE="your_webcast_cookie"
```

## Trace

```bash
bytedcli starfish trace --object-id example_obj@1
bytedcli starfish trace --object-id example_obj@1 --room-id 7634173330450402086 --task-type 203
bytedcli starfish trace --object-id example_obj@1 --start "2h ago" --end now
bytedcli --json starfish trace --object-id example_obj@1 --size 5
```

## Output shape

- 文本模式：按 object 输出 span 摘要表，适合快速看流水
- JSON 模式：返回完整的 `item_list`、`span_list`、`show_fields` 与 `tags`

## Task Type

`starfish task-type list` 调用 BFF 接口
`POST /starfish/api/bff/webcast/review/config/QueryReviewTaskTypeList`，
对应控制台 `https://webcast.bytedance.net/security/mona/task_type/list`。

```bash
bytedcli starfish task-type list
bytedcli starfish task-type list --status 1 --page-limit 50
bytedcli starfish task-type list --status 2 --page-limit 100
bytedcli starfish task-type list --task-type 203
bytedcli starfish task-type list --offset 20 --page-limit 20
bytedcli --json starfish task-type list --offset 20 --page-limit 100
```

常用过滤项：

- `--page-limit` 每页返回的任务类型数量，默认 20。
- `--offset` 翻页偏移，默认 0；`offset = page_limit * (page_index - 1)`。
- `--status` 任务状态过滤；`0` 不过滤，`1` 表示在用，`2` 表示已废弃。
- `--source` 来源过滤；`0` 不过滤，`1` 表示 starfish 自管。
- `--task-type` 作为后端过滤提示传入（如 `--task-type 203`），常用于反查某个 task_type 对应的名称；服务端实际是否做精确过滤未做完整线上验证，必要时再以 list 输出确认。
- `--pack-level` 与 `--cookie` 一般不需要传，控制台默认 `--pack-level 2`。

输出形态：

- 文本模式：表头 `TASK_TYPE / ID / NAME / POSITION / CATEGORY / PRIORITY / STATUS / OPERATOR`，并附上 `Matched N task type(s)` 摘要行。
- JSON 模式：`{ "total": <number>, "item_list": [{ id, name, position, operator, extra, priority, source, status, task_category, task_type, create_time, tcs_project_id_list }] }`。

### Task Type Max

`starfish task-type max` 用来快速回答“当前 Starfish 最大的 `TaskType` 数字是多少”。
内部依赖 `QueryReviewTaskTypeList` 默认按 `TaskType` 升序的事实，先用 `pageLimit=1` 取 `TotalCount`，
再用 `offset=TotalCount-1, pageLimit=1` 取尾页第一条，全程只发两次请求。

```bash
bytedcli starfish task-type max
bytedcli starfish task-type max --status 1
bytedcli starfish task-type max --source 1
bytedcli --json starfish task-type max
```

支持过滤项：

- `--status` 与 list 同义；常用 `--status 1` 限定到在用任务类型。
- `--source` 与 list 同义。
- `--pack-level` 与 `--cookie` 一般不需要传。

输出形态：

- 文本模式：先输出 `Scanned N task type(s); largest TaskType is X.` 摘要行与 filter 信息，再渲染该单条任务类型表格。
- JSON 模式：`{ "total": <number>, "max_task_type": <number|null>, "item": <task type item|null> }`。
- 当过滤后无任何任务类型时，文本模式输出 `No task types match the current filter.`，JSON 模式 `max_task_type` 与 `item` 都返回 `null`。

### Task Type Save

`starfish task-type save` 用来创建或更新一个 Starfish 审核任务类型。
对应后端接口 `POST /starfish/api/bff/webcast/review/config/SaveReviewTaskType`，与 list/max 共用 BFF cookie。

```bash
bytedcli starfish task-type save --task-type 99995 --name test_save --position test_save_99995
bytedcli starfish task-type save --task-type 99996 --name demo --position demo_position --operator another.user
bytedcli --json starfish task-type save --task-type 99997 --name demo --position demo_position
```

必填项：

- `--task-type` 目标 TaskType 数字 ID。如果该 ID 已存在，会以 save 语义覆盖现有记录。
- `--name` 任务类型显示名。
- `--position` 任务类型 position 字符串（业务侧用于路由）。

固定值默认填入（与控制台常用值一致），需要不同时再用对应 option 显式覆盖：

| 字段         | 默认值              | 对应 option       |
| ------------ | ------------------- | ----------------- |
| Operator     | `agent-op`          | `--operator`      |
| Priority     | `0`                 | `--priority`      |
| TaskCategory | `20`                | `--task-category` |
| Source       | `1`                 | `--source`        |
| Status       | `1`                 | `--status`        |

输出形态：

- 文本模式：`Saved task type <task_type> (id=<id>).` + `Name: <name> | Position: <position> | Note: SaveReviewTaskType writes to production; pre-check existence with task-type list --task-type <n>.`。
- JSON 模式：`{ "id": <string|null>, "task_type": <number|null> }`；`id` 始终以字符串返回，避免 19 位长整型在 JSON 数字解析阶段丢失精度。

注意事项：

- `--task-type` 会覆盖现网已存在的任务类型，调用前请先 `task-type list --task-type <n>` 或 `task-type max` 确认是否冲突。
- `Operator` 默认值 `agent-op` 仅是占位字符串，并非真实账号。如果后端对 `Operator` 做合法性校验，请通过 `--operator` 显式传入有效用户名。
- 因为接口语义就是 upsert，没有提供单独的 update 命令；后续如果出现 delete 接口再补 `task-type delete`。
