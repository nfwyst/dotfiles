# Live Trace 请求与响应结构

本文件描述 `live trace` 各子命令对应的请求与响应字段形态，用于 agent 组装参数和解读结果；不涉及具体接口地址。

功能映射：

- `live trace start`：按 `task_type` 发起一次 trace 任务，异步返回 `task_id`
- `live trace status`：查询一次 trace 任务的执行状态
- `live trace result`：拉取已完成 trace 任务的明细 / 节点 / tip 结果
- `live trace parse-msg`：把 trace 结果中的 base64 `pb_payload` 解析成可读 JSON

## Start Task

请求示例：

```json
{
  "operation": 1,
  "task_type": "ack_trace",
  "tenant_id": "live",
  "room_id_str": "123",
  "device_id_str": "456",
  "start_time": "2026-04-01T10:00:00Z",
  "end_time": "2026-04-01T10:05:00Z",
  "method": ["WebcastChatMessage"],
  "include_limited_msg": true
}
```

说明：

- `operation=1` 表示发起任务
- `task_type` 全量枚举：`caller_log`、`ack_trace`、`send_log`、`fetch_log`、`im_log`、`shark_detect`、`oncall`
- `tenant_id` 必须从 `tenant-options.md` 的枚举里单选
- `ack_trace` / `send_log` / `fetch_log` 都会异步创建任务并返回 `task_id`

返回核心字段：

```json
{
  "task_id": 12345,
  "comment": "请稍等片刻"
}
```

## Query Status

请求示例：

```json
{
  "operation": 2,
  "task_type": "ack_trace",
  "task_id": 12345
}
```

状态码：

- `10`：开始
- `100`：完成
- `200`：失败
- `300`：超时

## Query Result

请求示例：

```json
{
  "TaskId": 12345,
  "TaskType": "ack_trace",
  "ResultType": "table_data",
  "Page": 1,
  "Size": 20,
  "Filters": {
    "msg_id": "789",
    "conclusion_code": "2"
  }
}
```

`ResultType`：

- `table_data`
- `node_info`
- `tip_info`

任务类型映射要点：

- `ack_trace -> ack_trace`
- `send_log -> query_msg`
- `fetch_log -> query_ack`

返回核心字段：

- `status`
- `msg`
- `taskType`
- `table.headers`
- `table.filter`
- `table.rows`
- `table.page`
- `table.size`
- `table.total`
- `table.tips`
- `table.node_info`
- `taskInfo`

兼容性备注：

- `table.filter` 可能是对象，也可能是数组
- `taskInfo` 可能为 `null`
- `ack_trace` 和 `send_log` 结果通常会补 `pb_payload`

## Parse Message

请求示例：

```json
{
  "msg_type": 0,
  "method": "WebcastChatMessage",
  "content": "BASE64_PAYLOAD",
  "use_test_idl": false
}
```

说明：

- `msg_type=0` 表示 IM 消息
- `msg_type=1/2/3` 表示 ByteLink 消息
- 返回字段 `msg` 是解析后的 JSON 字符串
