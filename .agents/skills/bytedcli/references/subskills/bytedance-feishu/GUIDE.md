---
name: bytedance-feishu
description: "Operate Feishu/Lark collaboration workflows via bytedcli: authenticate a Feishu bot, read/create/update docs, search docs and wiki, manage calendars and meetings, create tasks and subtasks, comment on docs, edit sheets and bitables, send or inspect chats and messages, and manage whiteboards (create/get/delete nodes, download as PNG). Use this skill whenever the user wants work done inside Feishu/Lark, especially for document collaboration, meeting scheduling, todo creation, chat operations, spreadsheets, Bitable data, or whiteboard/board drawings."
---

# bytedcli Feishu

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

- 读取、创建、更新 Feishu/Lark 文档
- 搜索文档、Wiki、用户、群聊
- 约会议、查日历、加参会人、查忙闲
- 创建待办、任务清单、评论、子任务
- 评论文档、上传/下载文档媒体
- 读写电子表格、导出表格
- 管理多维表格（Bitable）应用、表、记录、字段、视图
- 发送消息、回复消息、拉取历史消息与资源

## 能力范围

这个 skill 的能力范围对齐 `openclaw-lark` 里最适合 CLI 化的协作能力，但执行方式统一收敛到 `bytedcli feishu`：

- 文档：`docs fetch-doc/create-doc/update-doc`
- 人和空间：`user`、`search doc-wiki`、`wiki`
- 日历：`calendar calendar/event/attendee/freebusy`
- 任务：`task task/tasklist/comment/subtask`
- 协作文档附件：`drive file/doc-comments/doc-media/doc-blocks`（含 block 删除）
- 表格：`sheet`
- 多维表格：`bitable`
- 消息与群聊：`im message/messages/resource`、`chat`
- IM 富媒体上传：`im image upload`（图片→image_key）、`im file upload`（文件→file_key）
- 画板：`board create-notes/get-nodes/delete-nodes/download`（创建/读取/删除节点、下载 PNG）

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 首次使用先执行 `feishu login`
- 如需指定/切换到某个 bot，使用 `feishu login --app-id <app_id> --app-secret <app_secret>`（会覆盖本地 bot 配置，并清空旧 token）
- 如果 scope 不足或需要补权限，执行 `feishu login --force-oauth`
- `feishu im message send/reply`、`im image upload`、`im file upload`、`chat create`、`chat add-members` 使用应用身份调用，依赖对应应用权限与 `tenant_access_token`，不通过用户 OAuth scope 申请
- `feishu login` 默认显示终端二维码；异步扫码或无终端场景可用 `feishu login --no-terminal-qr`，并在未显式传入 `--qr-image` 时自动生成临时二维码图片
- 如需显式指定二维码图片路径，可配合 `feishu login --qr-image [path]`
- `--json feishu login` 会自动关闭终端二维码，并默认生成临时二维码图片，便于 agent/脚本消费 `qr_image_ready`
- 默认域是 `feishu`，不需要额外配置

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## 工作流约定

1. 优先使用 `--json`，把 `--json` 放在 `feishu` 前面。
2. 需要操作人、群、文档前，先解析标识：
   - 用户：`feishu user search`
   - 文档/Wiki：直接用 URL 或 token
   - 群聊：`feishu chat search`
   - 新建群后继续操作成员时，先保存返回的 `chat_id`
3. 涉及自然语言时间时，转换成明确的绝对时间后再执行。
   - 例如“今天下午”应落成 `2026-03-18 16:00 +08:00` 这种确定时间，并在结果里说明假设。
4. 简单写操作优先用快捷参数；结构复杂时退回 `--body-json` / `--values-json`。写公式单元格时，要用 `{"type":"formula","text":"=A1"}` 这样的对象，不要只传字符串 `=A1`。
5. 写操作完成后，尽量回读一次关键对象，确认结果。

## Quick start

```bash
# 鉴权
bytedcli feishu login
bytedcli feishu login --app-id "<app_id>" --app-secret "<app_secret>"   # 指定/切换到某个 bot（会覆盖本地 bot 配置）
bytedcli feishu login --force-oauth
bytedcli feishu login --no-terminal-qr

# 读写文档
bytedcli --json feishu docs fetch-doc "https://bytedance.larkoffice.com/docx/..."
bytedcli --json feishu docs create-doc --title "周会纪要" --markdown "# 议题"
bytedcli --json feishu docs update-doc --doc-id "doccn..." --mode append --markdown "## 新增段落"

# 搜人 / 搜文档 / 搜 Wiki
bytedcli --json feishu user search --query "zhangsan"
bytedcli --json feishu search doc-wiki --query "研发规范"
bytedcli --json feishu wiki node list --space-id "wikc..."

# 约会议
bytedcli --json feishu calendar calendar list
bytedcli --json feishu calendar event create --calendar-id "cal..." --summary "项目同步" --start-time "2026-03-18T16:00:00+08:00" --end-time "2026-03-18T16:30:00+08:00"
bytedcli --json feishu calendar attendee create --calendar-id "cal..." --event-id "evt..." --user-open-id "ou_xxx" --need-notification

# 创建待办
bytedcli --json feishu task task create --summary "补齐接口文档" --due "2026-03-20T18:00:00+08:00" --member "ou_xxx:assignee"

# 上传图片/文件到 IM（获取 key 后可用于发送富媒体消息）
bytedcli --json feishu im image upload --file-path "./photo.png"
bytedcli --json feishu im file upload --file-path "./report.pdf"
bytedcli --json feishu im file upload --file-path "./video.mp4"

# 发送消息（文本/图片/文件/视频）/ 回复消息
bytedcli --json feishu im message send --receive-id-type open_id --receive-id "ou_xxx" --text "hello"
bytedcli --json feishu im message send --receive-id-type open_id --receive-id "ou_xxx" --msg-type image --content-json '{"image_key":"img_xxx"}'
bytedcli --json feishu im message send --receive-id-type open_id --receive-id "ou_xxx" --msg-type file --content-json '{"file_key":"file_xxx"}'
bytedcli --json feishu im message send --receive-id-type open_id --receive-id "ou_xxx" --msg-type media --content-json '{"file_key":"file_xxx","image_key":"img_xxx"}'
bytedcli --json feishu im message reply --message-id "om_xxx" --text "收到"

# 读取群聊消息历史（注意：是 messages 复数，不是 message 单数）
bytedcli --json feishu im messages get --chat-id "oc_xxx"
bytedcli --json feishu im messages get --chat-id "oc_xxx" --page-size 20

# 搜索消息
bytedcli --json feishu im messages search --query "关键词"

# 评论文档
bytedcli --json feishu drive doc-comments create --file-token "doccn..." --text "请确认这里" --mention-open-id "ou_xxx"

# 表格 / 多维表格
bytedcli --json feishu sheet write --url "https://..." --sheet-id "sheet1" --range "A1:B2" --values-json "[[\"name\",\"status\"],[\"demo\",\"done\"]]"
bytedcli --json feishu sheet write --url "https://..." --sheet-id "sheet1" --range "C2:C2" --values-json "[[{\"type\":\"formula\",\"text\":\"=A2+B2\"}]]"
# 大批量数据改用 --values-file（绕开 shell argv 长度限制，create/append/prepend/write 通用）
bytedcli --json feishu sheet append --url "https://..." --sheet-id "sheet1" --values-file ./values.json
bytedcli --json feishu sheet prepend --url "https://..." --sheet-id "sheet1" --range "A2:B2" --values-file ./values.json
bytedcli --json feishu sheet create --title "demo" --headers-json "[\"col1\",\"col2\"]" --values-file ./values.json
bytedcli --json feishu bitable record list --url "https://bytedance.larkoffice.com/sheets/xxxxxxxx?table=tbl_xxx&view=vew_xxx" --page-size 100
bytedcli --json feishu bitable record create --app-token "app..." --table-id "tbl..." --body-json "{\"fields\":{\"Name\":\"demo\"}}"

# 画板（whiteboard）
bytedcli feishu board create-notes <whiteboard_id> nodes.json          # 从 JSON 文件创建节点
bytedcli feishu board create-notes <whiteboard_id> '<json>' --source-type content  # 内联 JSON
bytedcli feishu board get-nodes <whiteboard_id>                        # 获取所有节点
bytedcli feishu board delete-nodes <whiteboard_id> --node-ids o1:1,o1:2  # 删除指定节点
bytedcli feishu board download <whiteboard_id> --output output.png     # 下载为 PNG
```

## 常见工作流

### 1. 根据文档执行动作

- 先 `feishu docs fetch-doc <docIdOrUrl>` 获取正文
- 从正文中提取会议、待办、评论、表格更新等意图
- 如涉及用户，先 `feishu user search --query <name>`
- 如涉及会议，按“查 calendar -> create event -> create attendee”执行
- 如涉及待办，按“resolve user -> task task create”执行

### 2. 约会议

- 先确定主日历：`feishu calendar calendar list`
- 创建事件：`feishu calendar event create`
- 添加参会人：`feishu calendar attendee create`
- 如果用户只给了模糊时间，先转成明确时间并在回复里说明假设

### 3. 创建待办

- 用户名先解析成 `open_id`
- 用 `feishu task task create` 创建任务
- 需要补充上下文时再追加 `comment create` 或 `subtask create`

### 4. 协作文档

- 读取现状：`docs fetch-doc`
- 新建：`docs create-doc`
- 局部更新优先 `update-doc --mode append|replace_range|insert_after`
- 需要协作反馈时用 `drive doc-comments create`

### 5. 表格与 Bitable

- 普通电子表格优先 `sheet read/write/append/prepend/find/export`
- 多维表格优先 `bitable record/table/field/view`
- 如果用户给的是 `sheets/...?...table=...&view=...` 这类链接，优先直接用 `bitable record list --url`，CLI 会自动解析真实 `app_token/table_id`，并继承当前 `view_id`
- 复杂字段结构不要硬拆，直接使用 `--body-json`

### 6. 画板（Whiteboard）

创建文档时通过 markdown 中的 `<whiteboard type="blank"></whiteboard>` 标签自动创建画板，返回 `board_tokens`。

```bash
# 创建文档 + 画板
bytedcli feishu docs create-doc --title "架构图" --markdown '<whiteboard type="blank"></whiteboard>'
# → 返回 board_tokens: ["xxx"]

# 创建形状节点（先形状，再连线）
bytedcli feishu board create-notes $BOARD_ID shapes.json

# 创建连接线（引用形状的 node_ids）
bytedcli feishu board create-notes $BOARD_ID connectors.json

# 截图验证
bytedcli feishu board download $BOARD_ID --output output.png
```

**关键约束**：
- 先创建形状节点，再创建连接线（连线通过 ID 引用形状）
- 节点 JSON 只用安全字段（type/x/y/width/height/composite_shape/text/style/z_index），多余字段导致 2890002 错误
- create-notes 返回的 node_ids 在 `data.ids` 字段
- 重画画板：先 `get-nodes` 获取 ID → `delete-nodes` 删除 → `create-notes` 重建

## Notes

- `--json` 是全局参数，必须写在 `feishu` 前面，例如 `--json feishu user get`
- `feishu docs fetch-doc` 在文本模式下会直接输出原始文档内容，不走表格渲染
- 某些写命令缺少关键输入时会直接输出 help；先看 `-h`
- 当返回 `Not authenticated` 或提示 scope 不足时，优先执行 `feishu login --force-oauth`
- `feishu sheet read` 如果命中 `FEISHU_SHEET_EMBEDDED_BITABLE`，不要继续按 worksheet 重试；直接改走 `feishu bitable record list --url "<原始 sheet 链接>"`

## References

- `references/feishu.md`
- `references/invocation.md`
- `references/troubleshooting.md`
