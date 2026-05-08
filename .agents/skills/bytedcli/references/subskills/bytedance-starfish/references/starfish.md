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
