---
name: bytedance-bpm
description: "BPM 流程平台（O2O 项目）: 通过 bytedcli 查询工单、日志、评论、可执行操作，并推进或取消工单。"
---

# BPM（bytedcli）

## 如何调用 bytedcli

下面示例默认直接写 `bytedcli`。

```bash
# 方式 1：直接用 npx 运行最新版
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]

# 方式 2：先全局安装，再直接调用 bytedcli
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli <command> [options]
```

## 核心工单处理流程

推荐按下面顺序使用：

1. `bpm ticket list`：从列表找到要处理的工单（我的待办 / 我可处理等）；已知 `ticket-id` 可跳过
2. `bpm ticket get`：查看工单详情信息、处理人与上下文（确认 `status/assignee/config`）
3. `bpm ticket op-keys`：确认当前节点可执行的操作按钮（`op_key`）与目标状态
4. `bpm ticket update-status`：执行通过 / 拒绝 / 下一步等状态推进（建议带 `--current-status` 做并发保护）
5. `bpm ticket comment`：如果是AI自动化工单操作，建议提交评论留痕，将审批的逻辑原因写明，后面可审计。固定格式：「AI自动化：评论内容」
6. `bpm ticket logs`：查看处理日志，确认流转结果
7. `bpm ticket cancel`：兜底场景，需强制关闭未完成工单时使用

常见场景：

- 处理我的待办(为主处理人)：`bpm ticket list --my-todo` → `get` → `op-keys` → `update-status` → `logs`
- 我可处理的工单(为备处理人)：`bpm ticket list --my-actionable`（筛选逻辑不同于 `--my-todo`）
- 查已结束工单：`bpm ticket list --finished done --finished closed`（也兼容 `1/2`）

补充说明：

- `status/status_name`：流程节点（例如 `reviewing` / `todo`），用于「推进到下一节点」
- `finished`：是否已结束（`progress/done/closed`），用于「筛选工单是否结束」

一个完整的处理示例（从“我的待办”到“推进状态”）：

```bash
# 1) 先列出我的待办（默认只看未结束：progress）
bytedcli --json bpm ticket list --my-todo --limit 20

# 2) 查看某条工单详情（确认当前 status/assignee/config）
bytedcli --json bpm ticket get --ticket-id 123456

# 3) 拉取当前节点可执行操作（选择要点哪个按钮）
bytedcli --json bpm ticket op-keys --ticket-id 123456

# 4) 根据 op-keys 返回，填写 op_key / current_status / 目标 status
bytedcli --json bpm ticket update-status \
  --ticket-id 123456 \
  --status done \
  --op-key approve \
  --current-status reviewing

# 5) 查看日志确认已流转
bytedcli --json bpm ticket logs --ticket-id 123456 --page 1 --page-size 20

# 可选：向工单提交评论
bytedcli --json bpm ticket comment --ticket-id 123456 --message "sample comment"
```

> 说明：下面只覆盖当前仓库已落地的 bytedcli 命令与参数。

### 1) 获取工单详情：`bpm ticket get`

```bash
# 建议：需要结构化输出时用 --json，并放在 domain 之前
bytedcli --json bpm ticket get --ticket-id 123456

# 可选：临时覆盖 BPM 站点（默认复用全局 --site）
bytedcli --json bpm ticket get --ticket-id 123456 --bpm-site cn
```

- 必填参数：`--ticket-id <id>`
- 可选参数：`--bpm-site <site>`（如 `cn` / `boe` / `i18n-tt`，仅覆盖本次请求）
- 输出：
  - `--json`：返回完整 `ticket detail` 结构（包含 `config` 等字段）
  - 非 `--json`：展示摘要 KV（Ticket ID / Workflow / Status / Finished / Creator / Assignee / Current Assignees / Created/Updated 等）

### 2) 获取工单列表：`bpm ticket list`

#### 2.1 基础分页

```bash
bytedcli --json bpm ticket list --page 1 --page-size 20
```

#### 2.2 服务端筛选（透传到 BPM API）

```bash
bytedcli --json bpm ticket list --target-system demo-system
bytedcli --json bpm ticket list --workflow-config-id 10001
bytedcli --json bpm ticket list --workflow-key demo-workflow
bytedcli --json bpm ticket list --status todo
bytedcli --json bpm ticket list --finished progress --finished done
bytedcli --json bpm ticket list --creator demo-user
bytedcli --json bpm ticket list --assignee demo-reviewer
bytedcli --json bpm ticket list --multi-assignee demo-reviewer
bytedcli --json bpm ticket list --start 2026-01-01T00:00:00+08:00 --end 2026-01-02T00:00:00+08:00
bytedcli --json bpm ticket list --keyword '"key":"value"'
```

- `--finished`：`progress=in progress`、`done=done`、`closed=closed`，可多次传入（如 `--finished progress --finished done`；也兼容 `0/1/2`）
- `--keyword`：按 `config` 里的键值搜索，示例形态为 `"key":"value"`（字符串原样透传）
- `--assignee`：按主处理人筛选
- `--multi-assignee`：按 `assignee/current_assignees` 相关处理人筛选
- `--workflow-key`：按流程 key / 名称筛选
- `--start` / `--end`：按创建时间范围筛选

#### 2.3 本地过滤模式（我的待办 / 我可处理）

```bash
# 我的待办：record.assignee 匹配当前用户
bytedcli --json bpm ticket list --my-todo

# 我可处理：record.current_assignees 包含当前用户
bytedcli --json bpm ticket list --my-actionable

# 覆盖用于匹配的用户名（避免依赖 auth.userinfo）
bytedcli --json bpm ticket list --my-todo --me demo-user

# 控制扫描页数与返回条数
bytedcli --json bpm ticket list --my-todo --max-pages 5 --limit 50
```

- `--my-todo`：仅保留 `assignee` 为“我”的工单
- `--my-actionable`：仅保留 `current_assignees` 中包含“我”的工单
- `--me <username>`：覆盖“我”的用户名；未提供时会尝试通过 `bytedcli auth userinfo` 推断
- `--max-pages <n>`：过滤模式下最多扫描的分页数（默认 `5`）
- `--limit <n>`：过滤模式下最多返回的记录数（默认等于 `--page-size`）
- 过滤模式默认只看未结束工单：若未显式传 `--finished`，会默认使用 `--finished progress`

### 3) 获取工单日志：`bpm ticket logs`

```bash
bytedcli --json bpm ticket logs --ticket-id 123456
bytedcli --json bpm ticket logs --ticket-id 123456 --page 1 --page-size 50 --with-op-data
```

- 必填参数：`--ticket-id <id>`
- 可选参数：`--page <n>`、`--page-size <n>`、`--with-op-data`、`--bpm-site <site>`
- 输出：
  - `--json`：返回 `logs` 数组与分页信息
  - 非 `--json`：展示时间 / 创建人 / 状态流转 / 内容摘要表格

### 4) 获取当前可执行操作：`bpm ticket op-keys`

```bash
bytedcli --json bpm ticket op-keys --ticket-id 123456
```

- 必填参数：`--ticket-id <id>`
- 建议在 `update-status` 前先执行一次：
  - 选择要点击的操作按钮：`op_key` / `op_name`
  - 确认本次推进的目标节点：`target status`
  - 获取并发保护用的当前节点：`current status`
  - 若存在并行分支或多条操作规则，可能需要额外关注 `branch`
- 输出：
  - `--json`：返回当前节点可执行操作列表
  - 非 `--json`：展示 `op_key / op_name / target status / current status / rule / branch`

### 5) 提交工单评论：`bpm ticket comment`

```bash
bytedcli --json bpm ticket comment --ticket-id 123456 --message "sample comment"

# 可选：临时覆盖 BPM 站点
bytedcli --json bpm ticket comment --bpm-site i18n-tt --ticket-id 123456 --message "sample comment"
```

- 必填参数：`--ticket-id <id>`、`--message <text>`
- 可选参数：`--bpm-site <site>`
- `--message` 会按 BPM Web 的 Markdown 评论格式提交；普通文本会自动包装为 Markdown 内容
- 输出：
  - `--json`：返回评论内容与 BPM API 返回的日志记录
  - 非 `--json`：展示评论 ID、创建人和内容摘要

### 6) 推进工单状态：`bpm ticket update-status`

```bash
bytedcli --json bpm ticket update-status --ticket-id 123456 --status done

# 常见做法：先通过 op-keys 拿到 op_key 与 current_status，再执行 update-status
bytedcli --json bpm ticket update-status \
  --ticket-id 123456 \
  --status done \
  --op-key approve \
  --current-status reviewing \
  --op-data '{"comment":"LGTM"}'

# op_data 也可从文件读取
bytedcli --json bpm ticket update-status \
  --ticket-id 123456 \
  --status done \
  --op-data-file ./op-data.json \
  --merge
```

- 必填参数：`--ticket-id <id>`、`--status <status>`
- 常用参数：
  - `--op-key <key>`：操作按钮 key
  - `--current-status <status>`：并发校验，避免状态已变化时误操作（强烈建议配合 `op-keys` 使用）
  - `--op-data <json>` / `--op-data-file <path>`：操作补充参数（JSON 字符串 / JSON 文件）
  - `--merge`：将 `op_data` 合并进工单上下文
  - `--branch-id <id>`：并行审批分支场景使用
- 输出：
  - `--json`：返回本次操作入参与 BPM API 返回结果
  - 非 `--json`：展示目标状态、op_key、branch、merge、结果摘要

`op_data` 常见写法建议：

- 终端里直接传 JSON 时，优先用单引号包住：`--op-data '{"comment":"LGTM"}'`
- JSON 较长或包含复杂字段时，用文件更稳：`--op-data-file ./op-data.json`

### 7) 取消工单：`bpm ticket cancel`

```bash
bytedcli --json bpm ticket cancel --ticket-id 123456
```

- 必填参数：`--ticket-id <id>`
- 适用于强制关闭未完成工单；实际权限由 BPM 服务端校验

### 8) 兼容别名

- `bpm get`（隐藏命令）等价于 `bpm ticket get`

## Notes

- 如遇鉴权问题，先执行 `bytedcli auth login`。
- 若要执行状态推进，优先先跑 `bpm ticket op-keys`，再执行 `bpm ticket update-status`。
- `--current-status` 适合用于并发保护；若返回状态已变化，请重新获取详情与 op-keys。
- 可通过 `BYTEDCLI_BPM_O2O_API_BASE_URL`（优先）或 `BYTEDCLI_BPM_API_BASE_URL` 覆盖 BPM API base URL（一般用于联调/网关差异）。
