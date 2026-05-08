# Feishu 能力与工作流

这个 skill 面向协作工作流，不只是“会调某个命令”。下面是推荐的能力映射。

## 1. 文档协作

适用场景：

- 读取需求文档、会议纪要、周报
- 生成新文档
- 在现有文档中追加或替换章节

推荐流程：

1. `feishu docs fetch-doc` 读取文档正文
2. 分析用户意图，提取需要执行的动作
3. 需要新建时用 `feishu docs create-doc`
4. 需要局部修改时优先 `feishu docs update-doc`
5. 需要协作反馈时用 `feishu drive doc-comments create`

群聊协作文档权限：

- 如果 Bot 在群聊上下文里创建文档，且文档是给这个群协作/阅读的，创建成功后应主动给当前群开阅读权限，再把链接发回群里。
- 新版飞书文档通常用 `--file-type docx`；群聊协作者用 `--member-type openchat --collaborator-type chat`，`--member-id` 填当前群 `chat_id`（`oc_xxx`）。
- 推荐优先给群聊授权，而不是逐个给群成员授权；只有用户明确要求按人授权时，再解析成员 `open_id` 后逐人添加。

```bash
bytedcli feishu docs permission-member create \
  --file-token docxcnxxxxxxxx \
  --file-type docx \
  --member-id oc_xxx \
  --member-type openchat \
  --collaborator-type chat \
  --perm view
```

## 2. 约会议

适用场景：

- “帮我约一个会”
- “查一下我和某人的空闲时间”
- “把某某加入会议”

推荐流程：

1. `feishu user search` 解析参与人的 `open_id`
2. `feishu calendar calendar list` 选择主日历
3. 如需先查忙闲，使用 `feishu calendar freebusy ...`
4. `feishu calendar event create` 创建会议
5. `feishu calendar attendee create` 添加参会人
6. 回传明确的绝对时间，而不是只写“今天下午”

## 3. 创建待办

适用场景：

- “给我建个待办”
- “和某某一起跟进这个事项”
- “给任务补评论/子任务”

推荐流程：

1. `feishu user search` 解析人员
2. `feishu task task create` 创建主任务
3. 需要拆分工作时用 `feishu task subtask create`
4. 需要补充说明时用 `feishu task comment create`

## 4. 搜索与导航

适用场景：

- 找某个文档、Wiki、群聊或用户

推荐命令：

- 用户：`feishu user search`
- 文档 / Wiki：`feishu search doc-wiki`
- 群聊：`feishu chat search`
- Wiki 空间 / 节点：`feishu wiki space ...`、`feishu wiki node ...`

## 5. 消息与聊天

适用场景：

- 给人发消息
- 回复消息
- 查群、建群、管理群成员、查消息历史、拉取消息资源

推荐流程：

1. 先通过 `user search` 或 `chat search` 拿到目标 ID
2. 确认应用本身已开通对应应用权限；`im message send/reply`、`im image upload`、`im file upload`、`chat create`、`chat add-members` 都使用应用身份和 `tenant_access_token`，不是用户 OAuth token
3. `feishu im message send` 或 `feishu im message reply` 发送/回复消息
4. 需要定位上下文时再用 `messages` / `resource`
5. 需要建群时用 `feishu chat create`
6. 需要加用户进群时用 `feishu chat add-members`
7. 需要加机器人进群时使用应用 `app_id`，并显式传 `--member-id-type app_id`

命令参考（注意 `message` 单数用于写操作，`messages` 复数用于读操作）：

- 发送消息：`feishu im message send --receive-id-type chat_id --receive-id <id> --text "内容"`
- 回复消息：`feishu im message reply --message-id <id> --text "内容"`
- 读取群聊消息历史：`feishu im messages get --chat-id <chat_id>`
- 搜索消息：`feishu im messages search --query <text>`
- 获取话题回复：`feishu im messages thread --thread-id <thread_id>`
- 下载消息附件：`feishu im resource --message-id <id> --file-key <key>`

## 6. 表格与多维表格

适用场景：

- 更新电子表格
- 导出表格
- 写 Bitable 记录

推荐命令：

- 电子表格：`feishu sheet read/write/append/prepend/find/create/export`
- 多维表格：`feishu bitable app/table/record/field/view`

实践建议：

- 简单二维数据用 `--values-json`（inline）
- 公式单元格要写成对象 `{"type":"formula","text":"=A1"}`；如果只传字符串 `=A1`，它会被当成普通文本写入
- 大批量（几百行以上）用 `--values-file <path>`，文件内容同 `--values-json`（`append`/`write`/`create` 都支持）
- 复杂多维表格结构用 `--body-json`
- 用户给的是 `sheets/...?...table=...&view=...` 时，优先直接用 `feishu bitable record list --url "<sheet链接>"`，CLI 会自动解析真实 `app_token/table_id` 并复用当前视图
- 修改前先读取当前结构，避免误写字段

## 7. IM 富媒体上传

发送图片/文件/视频前需先上传获取 key：

- 图片：`im image upload` → `image_key` → `im message send --msg-type image`
- 文件：`im file upload` → `file_key` → `im message send --msg-type file`
- 视频：`im file upload` + 可选 `im image upload`（封面）→ `im message send --msg-type media`

## 8. 原生语音气泡（IM Audio）

适用场景：

- 给个人或群聊发送原生飞书语音气泡
- 回复某条消息时用语音气泡补充说明
- 本地只有 `.mp3` / `.wav` / `.m4a` 等音频文件，需要自动转码后发送

推荐流程：

1. 先确认应用已完成 `feishu login`，并且 bot config 可用
2. 优先直接使用 `feishu im audio send` / `feishu im audio reply`
3. 输入如果不是 `.opus`，CLI 会尝试先转码成 Opus 再上传发送
4. 若运行环境没有 `ffmpeg`，先安装 `ffmpeg`，或直接传预先转好的 `.opus` 文件

命令示例：

- 发给个人：

  ```bash
  bytedcli feishu im audio send \
    --receive-id-type open_id \
    --receive-id ou_xxx \
    --file-path ./intro.mp3
  ```

- 发到群里：

  ```bash
  bytedcli feishu im audio send \
    --receive-id-type chat_id \
    --receive-id oc_xxx \
    --file-path ./status.wav
  ```

- 回复某条消息：

  ```bash
  bytedcli feishu im audio reply \
    --message-id om_xxx \
    --file-path ./followup.m4a
  ```

- 指定上传文件名与 UUID：

  ```bash
  bytedcli feishu im audio send \
    --receive-id-type chat_id \
    --receive-id oc_xxx \
    --file-path ./brief.mp3 \
    --file-name friday-brief.opus \
    --uuid friday-audio-20260423-01
  ```

- 手动先转码再发送：

  ```bash
  ffmpeg -y -i ./memo.mp3 -acodec libopus -ac 1 -ar 16000 ./memo.opus

  bytedcli feishu im audio send \
    --receive-id-type open_id \
    --receive-id ou_xxx \
    --file-path ./memo.opus
  ```

补充说明：

- `.opus` 默认直传；`.ogg`、`.mp3`、`.wav`、`.m4a`、`.aac`、`.flac`、`.wma` 会先转码
- 如果环境里没有 `ffmpeg`，transcode 路径会失败；报错 hint 会明确提示安装 `ffmpeg` 或改传 `.opus`
- 目标结果应是 **原生语音气泡**，而不是普通文件附件
