# bytedcli BITS Client 子域

`bits client` 用来承接客户端 OpenAPI 子域，不和现有的 `bits mr`、`bits component`、`bits pipeline` 对象域混在一起。
其中 workflow 相关 OpenAPI 现在只通过 `bits client workflow` 暴露，旧的根级 `bits workflow` 入口已经移除。

## 命令树概览

```bash
bytedcli bits client workflow ...
bytedcli bits client integration ...
bytedcli bits client calendar ...
```

## workflow

适用场景：
- workflow pipeline 查询
- workflow job 查询、重试、取消、跳过、更新
- pipeline template 触发
- 开发任务流水线列表和 quick-run

结构说明：

- `bits client workflow pipeline`
  - 面向 pipeline 级操作
  - 典型输入：
    - `pipelineId`
    - `mr-id`
    - template 触发参数
  - 常见用途：
    - 查 pipeline 详情
    - 触发 pipeline template
    - 从 MR 反查最新 pipeline
- `bits client workflow job`
  - 面向 job 级操作
  - 典型输入：
    - `jobId`
  - 常见用途：
    - 查 job 详情
    - 获取 job 日志链接
    - retry / cancel / skip
    - trigger / trigger-template
    - update / update-result / update-msg / update-url
    - add-artifacts
- `bits client workflow dev`
  - 面向开发任务挂载的流水线
  - 典型输入：
    - `dev_basic_id`
    - `task_name`
    - `space_id`
  - 常见用途：
    - 列出开发任务某个 task 下的 pipelines
    - 查看 workflow 主流水线
    - quick-run 开发任务流水线

选择建议：

- 你已经拿到 `pipelineId` 时，用 `workflow pipeline`
- 你已经拿到 `jobId` 时，用 `workflow job`
- 你要围绕某个开发任务 `dev_basic_id` 操作时，用 `workflow dev`
- 你手里只有 `mr-id`，但想看 pipeline，优先用 `workflow pipeline from-mr`

常用示例：

```bash
# pipeline 详情
bytedcli bits client workflow pipeline get --pipeline-id 123

# 触发 pipeline template（简单字段）
bytedcli bits client workflow pipeline trigger-template \
  --template-id 123 \
  --app-id 456 \
  --operator demo.user \
  --trigger-type template_custom

# 触发 pipeline template（完整 body）
bytedcli bits client workflow pipeline trigger-template \
  --body-file payload.json

# 从 MR 找最新 pipeline
bytedcli bits client workflow pipeline from-mr --mr-id 123456

# job 详情 / 日志链接 / 重试
bytedcli bits client workflow job get --job-id 123
bytedcli bits client workflow job log-url --job-id 123
bytedcli bits client workflow job retry --job-id 123 --env '{"key":"value"}'

# 取消 / 跳过
bytedcli bits client workflow job cancel --job-id 123 --reason "manual stop"
bytedcli bits client workflow job skip --job-id 123 --username demo.user --force true

# 触发 job
bytedcli bits client workflow job trigger \
  --type service \
  --name demo \
  --operator demo.user \
  --service-name demo.service

# dev task 下流水线列表
bytedcli bits client workflow dev list-pipelines \
  --dev-basic-id 123456 \
  --unique-type 1 \
  --task-name DemoTask

# dev task quick-run
bytedcli bits client workflow dev quick-run \
  --username demo.user \
  --dev-basic-id 123456 \
  --task-name DemoTask \
  --space-id 12345
```

参数约定：
- 简单接口尽量直接展开成 flag
- 复杂结构统一支持 `--body` / `--body-file`
- `--env`、`--allow-info`、`--pending-info` 这类复杂对象可直接传 JSON
- `--callback-urls`、`--depends-on`、`--control-planes` 支持 JSON 数组或逗号分隔

特别说明：
- `bits client workflow` 走的是客户端 OpenAPI，不等价于平台原生 `bits pipeline`
- `bits client workflow job` 里的 `jobId` 不是 `bits job-run` 使用的 `jobRunId`
- `jobId` 通常出现在 `https://example.bytedance.net/space/legacy/build/logs?jobId=<jobId>` 这类 legacy workflow 链接中
- `bits client workflow dev quick-run` 适合客户端研发的开发任务自测，不适合替代平台主流水线编排

## integration

适用场景：
- 查某个集成区版本
- 查集成区下 MR 列表、合入队列、正在合入中的 MR
- 查或生成封版报告
- 查或创建版本群

常用示例：

```bash
# 查集成区信息
bytedcli bits client integration info \
  --group-name douyin_harmony \
  --version 1.2.3

# 查版本列表
bytedcli bits client integration version-list \
  --group-name douyin_harmony \
  --page-size 10

# 查指定版本下 MR
bytedcli bits client integration mrs \
  --app-id 12345 \
  --version 1.2.3 \
  --mr-state opened

# 查合入队列 / 正在合入
bytedcli bits client integration queue \
  --group-name douyin_harmony \
  --target-branch rc/develop
bytedcli bits client integration merging \
  --group-name douyin_harmony

# 报告
bytedcli bits client integration report get \
  --group-name douyin_harmony \
  --version 1.2.3 \
  --snapshot latest
bytedcli bits client integration report snapshot \
  --group-name douyin_harmony \
  --version 1.2.3
bytedcli bits client integration report generate \
  --group-name douyin_harmony \
  --version 1.2.3 \
  --temporary false

# 版本群
bytedcli bits client integration version-group-get \
  --group-name douyin_harmony \
  --version 1.2.3
bytedcli bits client integration version-group-create \
  --group-name douyin_harmony \
  --version 1.2.3 \
  --is-binding false \
  --group-title "v1.2.3 version group"
```

## calendar

适用场景：
- 查版本日历 workspace
- 查某个 event / 下一个 event / 某日 segment
- 创建或更新事件
- 维护 mark

常用示例：

```bash
# workspace
bytedcli bits client calendar workspace list
bytedcli bits client calendar workspace active --time 1711929600
bytedcli bits client calendar workspace get --workspace-id 12345

# event
bytedcli bits client calendar event get --event-id 123
bytedcli bits client calendar event query \
  --time 1711929600 \
  --group-name douyin_harmony
bytedcli bits client calendar event next \
  --workspace-id 12345 \
  --time 1711929600

# event create / update
bytedcli bits client calendar event create \
  --track-id 123 \
  --workspace-id 456 \
  --name freeze \
  --start-date 1711929600 \
  --segments '[{"name":"freeze","length":1}]'

bytedcli bits client calendar event update \
  --event '{"event_id":1,"track_id":2,"name":"freeze","start_date":"1711929600"}' \
  --segments '[{"segment_id":1,"name":"freeze","length":1}]'

# mark
bytedcli bits client calendar mark add \
  --date 20260414 \
  --event-content "freeze" \
  --event-type-id 2
bytedcli bits client calendar mark delete --mark-id 123
```

## Notes

- `bits client` 是客户端 OpenAPI 子域，不替代现有 `bits pipeline`
- 复杂 payload 优先用 `--body-file`
- 需要结构化输出时，加全局 `--json`
