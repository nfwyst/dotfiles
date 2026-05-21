---
name: bytedance-lark-oncall
description: "通过 bytedcli 操作 Lark Oncall。适用于查询 oncall 工单、业务线历史 oncall、工单标签/归因结果、oncall 群聊消息、值班信息，或处理 Lark Oncall 工单列表/详情页面相关任务。"
---

# bytedcli Lark Oncall

当任务涉及 Lark Oncall 工单发现、历史收集或后续排查时，优先使用 `bytedcli lark-oncall`：

- `business search`：按业务名、bid 或路径解析业务节点。
- `ticket list`：按时间范围查询工单，并支持业务、类型、状态、堆栈、标签、经办人、报告人、应用、来源、工单 ID 等过滤条件。
- `ticket collect`：面向一个业务分页收集所有匹配工单，默认同时拉取每个工单的 oncall 群聊消息。
- `ticket get`：获取单个工单详情，包括平台返回的标签与归因类字段。
- `ticket messages`：获取单个工单对应的 oncall 群聊记录。
- `meta tags|types|attributions`：读取平台元数据，用于理解过滤项和标签含义。
- `duty query`：调用平台的值班/oncall 查询接口，查询指定业务的值班信息。

## 认证

Lark Oncall 不持久化独立的 domain auth token。命令会优先使用 `BYTEDCLI_LARK_ONCALL_COOKIE`；如果没有设置，则尝试从本机 Chromium 浏览器 profile 恢复 `lark-oncall.bytedance.net` 的 cookie；仍不可用时，复用 `bytedcli auth login --session --feishu` 维护的飞书 Web session。由飞书 session 换取到的 Lark Oncall app cookie 只保存在当前命令进程内存里，不落盘。

推荐的新用户 onboarding 流程：

```bash
bytedcli auth login --session --feishu
bytedcli lark-oncall ticket list --business demo-business --range 7d
```

如果命令仍返回 `LARK_ONCALL_AUTH_REQUIRED`，先重新执行 `bytedcli auth login --session --feishu`；如果仍失败，在 Chrome/Chromium 中登录后打开一次 Lark Oncall 工单页，再重试同一条 Lark Oncall 命令。自动化场景也可以通过 `BYTEDCLI_LARK_ONCALL_COOKIE` 直接提供有效的 Cookie header。

## 缓存

CLI 会缓存低频变化的元数据，缓存有效期为 15 天：

- 业务树
- 问题标签
- 归因选项
- 项目类型
- metadata 命令依赖的表单/全局配置

工单列表、工单详情和聊天消息始终实时请求平台。业务、标签等元数据刚变更时，在命令中加 `--refresh-cache` 强制刷新缓存。

## 常见流程

```bash
# 先解析业务 id 或完整路径
bytedcli lark-oncall business search --keyword demo-business

# 查询某个业务最近的工单；默认时间窗口为过去 7 天
bytedcli lark-oncall ticket list --business demo-business --range 7d --page-size 20

# 查询工单列表，并为每个工单附带 oncall 群聊消息
bytedcli lark-oncall ticket list --business demo-business --start 2026-05-01 --end 2026-05-08 --with-messages --message-limit 50

# 跨分页收集所有匹配工单和群聊记录；推荐使用 JSON 输出
bytedcli --json lark-oncall ticket collect --business demo-business --range 30d --max-pages 100

# 收集某个用户经办的已关闭工单；assignee/reporter 支持 username、姓名或 Oncall open_id
bytedcli --json lark-oncall ticket collect --business demo-business --range 30d --status 已关闭 --assignee demo-user

# 大批量收集时可适当提高消息拉取并发
bytedcli --json lark-oncall ticket collect --business demo-business --range 30d --message-concurrency 8

# 查看单个工单详情
bytedcli lark-oncall ticket get --ticket-id ticket_o123 --with-messages

# 只查看单个工单的群聊记录
bytedcli lark-oncall ticket messages --ticket-id ticket_o123 --limit 100

# 查看过滤和标签理解所需的元数据
bytedcli lark-oncall meta tags --limit 50
bytedcli lark-oncall meta attributions
```

需要机器可读输出时，全局 `--json` 要放在 domain 前面：

```bash
bytedcli --json lark-oncall ticket list --business demo-business --range 7d --with-messages
```

## 输出说明

文本模式下，`ticket messages` 输出按时间升序排列的聊天记录：

```text
Ticket: ticket_o123
Messages: 2

[2026-05-08 10:00:00] Example User (text)
  message text
```

JSON 模式保留结构化字段：

- `ticket_id`
- `messages[].messageId`
- `messages[].msgType`
- `messages[].senderId`
- `messages[].senderName`
- `messages[].rawText`
- `messages[].createdAt`
- `users_info`

批量分析时，优先使用 `bytedcli --json lark-oncall ticket list --with-messages`，这样工单字段和对应聊天窗口会保持绑定。

完整周期收集时，优先使用 `bytedcli --json lark-oncall ticket collect --business demo-business --range 30d`。命令返回 `tickets[]`，每个元素包含自己的 `ticket` 字段和 `messages[]`，顶层还包含 `page_count`、`fetched_ticket_count`、`fetched_message_count`、`truncated` 和 `stop_reason`。

`ticket collect` 的原始 JSON 不是工单和消息的笛卡尔积；每个工单对象下挂自己的 `messages[]`。导出表格时，如果目标是一行一个工单，应把 `messages[]` 合并成一个单元格字段；只有做消息明细分析时，才展开为一行一条消息。

`--message-limit` 不传时，会保留平台接口返回的全部消息；传入后，只保留每个工单最近的 N 条消息。需要完整聊天记录时不要设置 `--message-limit`。

`ticket collect` 因为平台使用 cursor 分页，所以工单页按顺序拉取；每页内的工单消息会并发拉取。默认消息并发为 4，`--message-concurrency` 最高允许 16，避免对平台造成过高压力。

状态过滤必须使用平台返回的精确枚举。当前已验证的常见状态包括 `已关闭`、`TO跟进中`、`TO待处理`、`RD跟进中`、`RD待处理`。查询已解决/已关闭工单时使用 `--status 已关闭`；不要使用 `solved`、`resolved`、`closed`、`done`、`fixed` 等英文别名，除非平台接口本身返回这些精确值。

`assignee` 和 `reporter` 过滤在传入非 `ou_...` 值时，会先通过 Lark Oncall 自身的用户搜索解析为 open_id，再查询工单。日常使用优先传 username，例如 `demo-user`；只有用户搜索存在歧义时，才直接传 Oncall 的 `ou_...` open_id。
