---
name: bytedance-live
description: "Operate ByteDance Live platform workflows via bytedcli, including Live Trace (trace task start/status/result/parse-msg) and live tenant queries. Use when tasks mention bytedcli live commands, live trace, ack_trace, request chain debugging, online trace inspection, trace-oriented incident analysis, or troubleshooting why an IM/live message was not received from ack_trace rows, trace JSON, or a task_id/msg_id pair."
---

# bytedcli Live

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

- 用户明确提到 `live trace`、`ack_trace`、`send_log`、`fetch_log`
- 用户给出 `task_id`、`msg_id`、trace JSON、`pb_payload`
- 用户想排查“为什么消息没收到”“请求链路卡在哪个节点”“某条 IM/live 消息是否下发成功”
- 用户需要先发起 trace，再轮询状态，再查表格明细、节点信息、tips 或解析 payload

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要先完成字节云登录：`bytedcli auth login`
- `tenant_id` 不能让用户自由输入，必须从 `references/tenant-options.md` 里的候选项中单选；如果用户还没给出明确租户，就展示候选项并让用户选择。

> 执行前缀见 `references/live trace.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
bytedcli live tenant list
bytedcli live trace start --task-type ack_trace --tenant-id live --room-id 123 --device-id 456 --start-time 2026-04-01T10:00:00Z --end-time 2026-04-01T10:05:00Z --method WebcastChatMessage
bytedcli live trace status --task-id 12345 --task-type ack_trace
bytedcli live trace result --task-id 12345 --task-type ack_trace --result-type table_data --filter msg_id=789
bytedcli live trace result --task-id 12345 --task-type ack_trace --result-type node_info
bytedcli live trace result --task-id 12345 --task-type ack_trace --result-type tip_info
bytedcli live trace parse-msg --msg-type 0 --method WebcastChatMessage --content BASE64_PAYLOAD
```

## 推荐流程

1. 如需先确认租户，执行 `live tenant list`。
2. 用 `live trace start` 发起任务。
3. 用 `live trace status` 轮询到 `status=100`。
4. 用 `live trace result --result-type table_data` 定位目标行，优先收敛到单条 `ack_trace` 行。
5. 如需串联链路或节点耗时，再查 `node_info`。
6. 如需聚合判断或提示信息，再查 `tip_info`。
7. 如需阅读 protobuf/base64 payload，再把 `pb_payload` 交给 `parse-msg`。

## 排查偏好

- `tenant_id` 必须视为单选枚举，不要让用户手输任意字符串；如果用户说的是业务名称，先在租户列表里做精确映射，再回填真实 `tenant_id`。
- 回答“为什么没收到”时，优先基于目标 `ack_trace` 行，不要只看 `parse-msg` 结果就下结论。
- 如果用户只给 `task_id`，先继续收敛到 `msg_id` 或单条目标行，再解释。
- 如果结果为空，先检查时间窗、`tenant_id`、`room_id`、`device_id`、`method` 是否收得过紧。
- `fetch_log` 结果通常不补 `pb_payload`；需要 payload 时优先看 `ack_trace` 或 `send_log`。
- `status=200/300` 时，先把任务失败或超时事实说清楚，再决定是否继续查结果接口。

## 常见输入缺口

- 缺 `tenant_id` 选择 / `room_id` / `device_id`
- 缺时间范围
- 缺目标 `msg_id`
- 只有一段 base64 payload，但没有 `method`

## References

- `references/invocation.md`：通用调用方式、站点切换、JSON 输出、HTTP 调试
- `references/live trace.md`：命令速查与推荐流程
- `references/api-shape.md`：接口结构与字段说明
- `references/tenant-options.md`：tenant_id 枚举候选表
- `references/troubleshooting.md`：常见错误与处理方法
