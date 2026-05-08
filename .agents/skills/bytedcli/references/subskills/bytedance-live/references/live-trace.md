# Live Trace

```bash
bytedcli live tenant list
bytedcli live trace start --task-type ack_trace --tenant-id live --room-id 123 --device-id 456 --start-time 2026-04-01T10:00:00Z --end-time 2026-04-01T10:05:00Z --method WebcastChatMessage
bytedcli live trace status --task-id 12345 --task-type ack_trace
bytedcli live trace result --task-id 12345 --task-type ack_trace --result-type table_data --filter msg_id=789
bytedcli live trace result --task-id 12345 --task-type ack_trace --result-type node_info
bytedcli live trace result --task-id 12345 --task-type ack_trace --result-type tip_info
bytedcli live trace parse-msg --msg-type 0 --method WebcastChatMessage --content BASE64_PAYLOAD
```

推荐顺序：

1. 如需先确认租户，执行 `live tenant list` 确定合法的 `--tenant-id`
2. `live trace start` 发起一次指定 `--task-type` 的 trace 任务，异步拿到 `task_id`
3. `live trace status` 轮询到 `status=100` 再继续
4. `live trace result --result-type table_data` 查明细表格，定位目标行
5. 如需链路节点或耗时，改用 `--result-type node_info`
6. 如需聚合提示 / 判断依据，改用 `--result-type tip_info`
7. 如需阅读 base64 `pb_payload`，再交给 `live trace parse-msg` 解析成可读 JSON

## `--task-type` 枚举

`task_type` 对应一次 trace 任务的某一个 trace 步骤，完整枚举如下：

| 值 | 含义 |
| --- | --- |
| `ack_trace` | 消息到达分析（解释“为什么没收到”的首选来源） |
| `send_log` | 消息发送记录 |
| `fetch_log` | 消息拉取记录 |
| `im_log` | LogID 查询 |
| `caller_log` | 调用方请求日志 |
| `shark_detect` | Shark 风控检测链路 |
| `oncall` | oncall 值班链路兜底 |

## `--result-type` 枚举

| 值 | 含义 |
| --- | --- |
| `table_data` | 明细表格，定位目标行 |
| `node_info` | 链路节点与耗时 |
| `tip_info` | 聚合提示 / 判断辅助信息 |

## `--msg-type` 枚举（`parse-msg`）

| 值 | 含义 |
| --- | --- |
| `0` | IM 消息 |
| `1` / `2` / `3` | ByteLink 消息 |

要点：

- `live trace start` 的必填参数是 `--task-type`、`--tenant-id`、`--room-id`、`--device-id`、`--start-time`、`--end-time`
- `--tenant-id` 不是自由输入项，必须从 `tenant-options.md` 的候选列表中单选
- `live trace start` 与 `live trace status` 共用“发起 / 查状态”入口
- `live trace result` 同时支持明细、节点、聚合 tips 三种结果
- `ack_trace` 是解释“为什么没收到”的首选来源
