# Holmes

## Commands

### 查看压测任务详情

```bash
bytedcli holmes trust-press get --tanker-id 106092
bytedcli --json holmes trust-press get --tanker-id 106092
```

- `--tanker-id`（必选）：TrustPress 任务 ID，对应页面 URL 中的 `tankerId`
- `--service-name`（可选）：服务名，仅用于上下文展示

### 输出字段

| 字段            | 说明                                            |
| --------------- | ----------------------------------------------- |
| Task Type       | 任务类型（Deploy Mode / Canary Mode / AB Mode） |
| Task ID         | 任务 ID（tanker ID）                            |
| Service Name    | 压测目标服务名                                  |
| Creator         | 创建人                                          |
| Create Time     | 创建时间                                        |
| Start Time      | 压测开始时间                                    |
| End Time        | 压测结束时间                                    |
| Success Count   | 成功请求数                                      |
| Failure Count   | 失败请求数                                      |
| Success Rate    | 成功率                                          |
| Test Parameters | 测试参数（method、AB mode、AB params）          |

### JSON 模式额外字段

JSON 输出 (`-j`) 包含更多信息：

- `deploy_info`：部署信息（branch、commit、committer、scm_link 等）
- `metric_counters`：完整的指标计数器列表
- `region`、`qps`、`traffic_source`：压测配置
- `raw`：API 返回的完整原始数据

## Authentication

Holmes 使用 BDSSO（字节单点登录）CAS 认证：

```bash
# 首次使用前执行，用飞书扫码完成认证
bytedcli auth login --session
```

认证流程：

1. `bytedcli auth login --session` 通过 QR 扫码在 `sso.bytedance.com` 创建 SSO session
2. 访问 Holmes API 时，自动通过 `sso.bytedance.com/cas/login` 获取 CAS ticket
3. CAS ticket 换取 Holmes 的 BDSSO session cookie（httpOnly）
4. 后续请求自动携带 session cookie

## TrustData SQL 查询与后续处理

TrustData 查询通过 `holmes trust-data` 命令执行，默认使用 i18n Holmes 后端。CLI 请求体固定使用 BytedCLI platform；提交 SQL 时不需要传 `--repo-id` 或 `--data-source-type`，后端会处理 data source 与 repo 归属。`sql-submit` 会从 SQL 的 `FROM`/`JOIN` 中识别完整表名（如 `db.table`），先调用 i18n `get_table_info --active-only` 查询活跃表元数据并自动确定 `region`；如果只命中一个活跃 region，会自动带该 region 提交。如果返回多个活跃 region，交互式终端会提示选择；JSON/非 TTY 模式会返回 `HOLMES_TRUSTDATA_REGION_AMBIGUOUS`，需要显式传 `--region` 重跑。用户不需要额外传 `--site i18n`。

### 提交 SQL

```bash
# 直接提交 SQL；TrustData API 默认走 i18n Holmes，CLI 会先用 get_table_info 自动确定 region
bytedcli holmes trust-data sql-submit \
  --sql "SELECT count(*) FROM example_db.example_table WHERE p_date = '2026-04-01'"

# 推荐给 Agent/脚本：从文件读取 SQL，并等待查询结果
bytedcli --json holmes trust-data sql-submit \
  --sql-file ./query.sql \
  --wait \
  --poll-interval-ms 5000 \
  --wait-timeout-ms 180000

# 若 JSON/非 TTY 模式提示同名表或 region 歧义，用 --region 消歧
bytedcli holmes trust-data sql-submit --sql-file ./query.sql --region us-ttp
```

参数与行为：

- `--sql` 与 `--sql-file` 二选一；`--sql-file` 优先，适合避免 shell 转义问题。
- `sql-submit` 会根据 SQL 中的完整表名自动调用 `get_table_info --active-only`；若返回单一活跃 region，自动带该 region 提交。
- `--region` 用于覆盖自动检测结果，或在 JSON/非 TTY 模式收到 `HOLMES_TRUSTDATA_REGION_AMBIGUOUS` 后指定查询 region；推荐语义值：`us-ttp`、`eu-ttp`、`va`、`eu-ttp-no`、`us-ttp2`（兼容旧数字 1/2/3/4/5）。
- `--wait` 只在成功提交并拿到 `task_id` 后轮询结果 API；默认每 5 秒一次，最长等待 3 分钟。result API 可能在刚提交后短暂返回 `failed`/`unknown`，CLI 会至少等待 15 秒且连续确认失败后才停止。
- `--poll-interval-ms <ms>` 调整轮询间隔；`--wait-timeout-ms <ms>` 调整最长等待。
- `annotation_required` 或 `table_register_required` 是提交阶段的 follow-up 状态，不会进入结果轮询。
- 提交阶段如果遇到 `HTTP 502 Bad Gateway`，CLI 会自动简单重试，最多重试 2 次；重试后仍失败才返回 502 错误。

### Agent / JSON 模式处理规则

Agent 和脚本可以使用 `--json --wait` 稳定解析结果；JSON 模式不会关闭 TrustData 的自动能力（submit 前 region preflight、`--wait` 轮询都会继续执行），只是 stdout 保持纯 JSON，且不会自动打开浏览器：

- 提交前预检已内置：`sql-submit` 会识别 `db.table` 并先调 `get_table_info` 自动确定 region。若 JSON/非 TTY 模式返回 `HOLMES_TRUSTDATA_REGION_AMBIGUOUS`，从错误 details/candidates 中读取候选 region 后，用 `sql-submit --region <region>` 重跑；不要自行改写 SQL。
- 成功完成：读取 `data.result.rows`、`data.result.columns`、`data.result.row_count`，并在回复用户时渲染成表格；不要把单行结果只拼成纯文本值。
- 用户直接在终端运行且未传 `--json` 时，CLI 自身会把成功查询结果渲染成表格。
- 如果 `get_table_info` 命中多个活跃 region，提交和结果输出会展示本次实际使用的 selected region；向用户汇报结果时带上 region，避免不同 region 数据混淆。
- 查询失败：如果 CLI 连续确认失败后仍返回 `failed`，停止并向用户汇报 `data.task_id`、`data.url`、已使用的 region 和可选候选；不要自动尝试其他 region。只有用户明确要求继续，才可用另一个 `--region` 重跑同一 SQL。
- 结果状态未知：`unknown` 可能是 result API 的短暂过渡状态；`--wait` 会继续轮询直到成功、连续确认失败或超时。单独执行 `sql-result` 看到 `unknown` 时，稍后用同一 task_id 再查，不要立刻换 region。
- 仍在 pending/running 或等待超时：读取 `data.url` 并请用户打开 TrustData 页面检查进度；也可读取 `data.task_id`，稍后执行 `bytedcli holmes trust-data sql-result --task-id <task_id>`。
- 需要字段标注：读取 `data.annotation_url`，让用户完成 annotation 流程后重试提交。
- 需要注册表：读取 `data.table_register_url` 与 `data.new_table_name`，让用户完成 table registration 后重试提交。
- JSON/非 TTY 模式不会执行交互式 region 选择，也不会自动打开浏览器；遇到 `HOLMES_TRUSTDATA_REGION_AMBIGUOUS` 时，读取候选 region 并用 `--region` 重跑。

### Annotation required

当 `sql-submit` 返回 `annotation_required` 时，输出包含：

- `annotation_url`：可打开的标注表单 URL。
- `annotation_meta` / `encoded_annotation_meta`：后端返回并由前端预填的字段或表达式标注 metadata。

处理方式：打开 `annotation_url` 完成标注，然后重新执行同一条 SQL 查询。

### Table registration required

当 `sql-submit` 返回 `table_register_required`（后端错误码 `100008`）时，输出包含：

- `table_register_url`：`/trust-data/annotation/table-register?table_name=<name>&modal=1` 深链。
- `new_table_name`：后端返回的第一个缺失表名。

处理方式：打开 `table_register_url` 完成注册表流程，然后重新执行同一条 SQL 查询。

### 获取结果、历史与表信息

```bash
# task_id 可从 sql-submit 输出 URL 的 taskid 参数或 JSON data.task_id 获取
bytedcli holmes trust-data sql-result --task-id <task_id> --limit 50

# 查询最近 SQL 历史，找回 task_id 或确认提交记录
bytedcli holmes trust-data sql-history

# 列出已注册活跃表
bytedcli holmes trust-data list-tables --active-only

# 查询表提交元数据，用于排查同名表、region、data_source_type
bytedcli holmes trust-data table-info --table-name "example_db.example_table" --active-only

# 查询字段、类型、是否已标注及描述
bytedcli holmes trust-data fields --table-info "example_db.example_table"

# 若仅表名无法解析字段元数据，先 list-tables 获取完整 metadata，再传 JSON 给 --table-info
bytedcli --json holmes trust-data list-tables --active-only
bytedcli holmes trust-data fields \
  --table-info '{"table_name":"example_db.example_table","cluster_name":"example_cluster","table_type":0,"region":"1","is_active":true}'
```

`sql-result` 会自动解析 `data_source` JSON 为行列结构；`--limit` 控制文本展示行数。若 `task_status=3`，表示查询失败，通常需要简化 SQL 或缩短时间范围后重试。

### 创建压测任务

部署版本支持三种模式，三选一必填：

```bash
# Branch 模式
bytedcli holmes trust-press create \
  --service-name <svc> \
  --region <region> \
  --qps <n> \
  --branch <branch>

# SCM 版本模式
bytedcli holmes trust-press create \
  --service-name <svc> \
  --region <region> \
  --qps <n> \
  --scm 2.0.4.7452

# Commit 模式
bytedcli holmes trust-press create \
  --service-name <svc> \
  --region <region> \
  --qps <n> \
  --commit 9bbd0ad41137f9fa82430e860c8d9236bb00b433
```

省略 `--ip`/`--port`/`--instance-shard-id`/`--instance-name` 时，在 TTY 中弹出交互菜单从空闲 pod 列表中选择；非 TTY 场景（Agent、CI）需显式传入或先用 `pod list` 查询再传入。

| 参数                     | 说明                                                        |
| ------------------------ | ----------------------------------------------------------- |
| `--service-name`（必选） | 服务名（PSM 格式）                                          |
| `--region`（必选）       | 区域，如 `ttp`、`sg`                                        |
| `--qps`（必选）          | 目标 QPS                                                    |
| `--branch`               | 压测分支（branch 模式，与 `--scm`/`--commit` 三选一必填）   |
| `--scm`                  | SCM 版本号（SCM 模式，例如 `2.0.4.7452`，三选一必填）       |
| `--commit`               | Commit SHA（commit 模式，三选一必填）                       |
| `--ip`                   | Pod IP（省略时交互选择）                                    |
| `--port`                 | Pod 端口（省略时交互选择）                                  |
| `--instance-shard-id`    | Pod shard ID（省略时交互选择）                              |
| `--instance-name`        | Pod 实例名（省略时交互选择）                                |
| `--method`               | 测试方法名（默认 `sort`）                                   |
| `--ab-mode`              | AB 模式：`merge`（合并）/ `overwrite`（覆盖），默认 `merge` |
| `--ab-params`            | AB 参数 JSON 字符串（内联）                                 |
| `--ab-params-file`       | 从文件读取 AB 参数 JSON                                     |
| `--traffic-source`       | 流量来源（默认 `test_account`）                             |
| `--expire-seconds`       | 任务过期时间秒数（默认 `300`）                              |

`--branch`、`--scm`、`--commit` 必须恰好传一个。多传或都不传都会被命令拒绝（exit code 2）。

### 列出可用 Pod

```bash
bytedcli holmes trust-press pod list --service-name <svc> --region <region>
bytedcli holmes trust-press pod list --service-name <svc> --region <region> --all
```

- 默认只显示空闲 pod，按 CPU 使用率升序排列
- `--all` 显示全部 pod（含被占用的）
- `--task-type`（默认 `deploy`）、`--traffic-source`（默认 `test_account`）可按需指定

## 非 TTY 场景下创建任务（Agent / CI）

```bash
# 1. 查可用 pod
bytedcli --json holmes trust-press pod list --service-name <svc> --region <region>

# 2. 带完整 pod 参数创建（branch 模式）
bytedcli holmes trust-press create \
  --service-name <svc> --region <region> --qps <n> --branch <branch> \
  --ip <ip> --port <port> --instance-shard-id <shard> --instance-name <name>

# 2'. 带完整 pod 参数创建（SCM 版本模式）
bytedcli holmes trust-press create \
  --service-name <svc> --region <region> --qps <n> --scm 2.0.4.7452 \
  --ip <ip> --port <port> --instance-shard-id <shard> --instance-name <name>

# 2''. 带完整 pod 参数创建（commit 模式）
bytedcli holmes trust-press create \
  --service-name <svc> --region <region> --qps <n> --commit <sha> \
  --ip <ip> --port <port> --instance-shard-id <shard> --instance-name <name>
```

## URL 到命令的映射

TrustPress 页面 URL：

```
https://holmes.tiktok-row.net/recommend/trust-press/detail?serviceName=example_service&tankerId=106092&taskType=deploy
```

对应命令：

```bash
bytedcli holmes trust-press get --tanker-id 106092
```

只需要 `tankerId` 参数，`serviceName` 和 `taskType` 可选。

## 查询 TrustPress 日志

TrustPress 页面 Log tab 底层是对 i18n-tt 站点 Kibana ES 的查询。

### 认证

Kibana（`kibana-bytees-i18n.tiktok-row.net`）使用 BDSSO CAS 认证，与 Holmes API 相同，复用 `bytedcli auth login --session` 获取的 SSO session。bytedcli 自动走 CAS redirect 链获取 Kibana session cookie。**不要使用 doas**——doas GDPR token 不支持 us-ttp region。

### ES 查询参数

| 参数  | 值                    | 说明                                                |
| ----- | --------------------- | --------------------------------------------------- |
| site  | `i18n-tt`             | 全局 `--site` 参数                                  |
| PSM   | `byte.es.devinfra_sg` | DevInfra SG 的 Kibana 实例                          |
| Index | `tpress_logs-*`       | 按日期分片的时序索引（如 `tpress_logs-2026-04-14`） |
| IDC   | `my`（默认）          | 马来西亚机房，i18n-tt 站点默认值                    |

### 常用查询字段

| 字段           | 说明                                   |
| -------------- | -------------------------------------- |
| `tanker_id`    | TrustPress 任务 ID                     |
| `log_id`       | 日志 ID（对应页面 Log tab 中的 LogID） |
| `log_level`    | 日志级别（INFO、WARN、ERROR）          |
| `log_message`  | 日志内容                               |
| `log_location` | 代码位置（文件:行号）                  |
| `psm`          | 服务 PSM                               |
| `pod_name`     | Pod 名称                               |
| `idc`          | 机房（如 `useast5`）                   |
| `timestamp`    | 时间戳                                 |

### 命令示例

```bash
# 按 tanker_id 搜索全部日志
bytedcli --site i18n-tt es search \
  --psm byte.es.devinfra_sg \
  --index 'tpress_logs-*' \
  --query '{"query":{"match_phrase":{"tanker_id":"107365"}}}'

# 按 tanker_id + log_id 精确搜索
bytedcli --site i18n-tt es search \
  --psm byte.es.devinfra_sg \
  --index 'tpress_logs-*' \
  --query '{"query":{"bool":{"must":[{"match_phrase":{"tanker_id":"107365"}},{"match_phrase":{"log_id":"20260412225810EE42A48248883C064F42"}}]}}}'

# 只搜索 WARN/ERROR 级别
bytedcli --site i18n-tt es search \
  --psm byte.es.devinfra_sg \
  --index 'tpress_logs-*' \
  --query '{"query":{"bool":{"must":[{"match_phrase":{"tanker_id":"107365"}},{"terms":{"log_level":["WARN","ERROR"]}}]}}}'
```

## Code-review ticket(Change Type / Checks)

每个 GitLab MR 都对应一个 Holmes code-review ticket,页面 URL:
`https://holmes.tiktok-row.net/code-review/ticket-detail?gitlab_repo_name=<repo>&mr_id=<n>`

该页面包含 Change Type、Ticket Status、reviewers、以及分组 Checks(diff / release_manager_tested / compatibility / other)。bytedcli 可以直接拿到这些结构化信息:

```bash
# 直接用 GitLab MR URL,最常见
bytedcli holmes code-review get --url https://code.byted.org/tiktok-plus/tiktok_sort/merge_requests/3984

# 或用 Holmes ticket-detail URL
bytedcli holmes code-review get --url 'https://holmes.tiktok-row.net/code-review/ticket-detail?gitlab_repo_name=tiktok-plus/tiktok_sort&mr_id=3984'

# 等价的显式参数
bytedcli holmes code-review get --repo tiktok-plus/tiktok_sort --mr-id 3984

# 只要 ticket header,不拉 checks(更快)
bytedcli holmes code-review get --url <url> --no-include-checks

# JSON 输出,适合脚本消费
bytedcli --json holmes code-review get --url <url>

# 查 change_type 等枚举值的详细说明
bytedcli holmes code-review enums
```

输出包含:

- Ticket 标识:`ticket_id` / `mr_id` / `gitlab_repo_name` / `mr_title` / `commit_id` / `branch` / `committer`
- 状态:`mr_state`(opened/merged/closed) / `ticket_status`(in_checker_before_cr / ...) / `meta_status.status`
- **`change_type`**(`new_code_protected_by_ab_switch` / `launch` / `release_manager_tested` / `gurantee_no_metric_change` / `revert` / ...)
- reviewers 三类:`logic_reviewers` / `change_type_reviewers` / `skip_owners`,每项 `{username, status}`
- `idcs` / `business` / `effective_scope`
- 分组 Checks:`check_groups[]`(group/enable_retry/checks[]) + `check_summary`(total/by_status/blocking_failures)
  - 每条 check:`name`/`check_type`/`check_status`(waiting/in_check/success/failed/skipped/...)/`block`(failure 是否阻塞 merge)/`idc`/`url`/`retry_num`

### 编辑 ticket(`code-review update`)

对应 web 上「编辑 ticket」面板。可改字段:`change_type`、`idcs`(受影响 region)、`global_inconsistent_reason`(全局不一致原因),以及 `check_input` 子树(`rm_tested.rm_url`、`related_release.related_mr`、`related_release.related_release`)。

```bash
# 把 ticket 标记为 release_manager_tested,只影响 ttp,global inconsistent reason=US
bytedcli holmes code-review update --ticket-id 76617 \
    --idcs ttp \
    --change-type release_manager_tested \
    --global-inconsistent-reason US

# 多 region 一次设全(idcs 用逗号分隔)
bytedcli holmes code-review update --ticket-id 76617 \
    --idcs i18n,ttp,i18n_sg,i18n_va,i18n_gcp \
    --change-type release_manager_tested --global-inconsistent-reason US

# 用 MR URL 而非 ticket-id(底层先 GET 一次拿 ticket_id)
bytedcli holmes code-review update --url https://code.byted.org/tiktok-plus/tiktok_sort/merge_requests/4118 \
    --idcs ttp --change-type release_manager_tested --global-inconsistent-reason US

# 设置 Release Manager URL(填入 check_input.rm_tested.rm_url)
bytedcli holmes code-review update --ticket-id 76617 \
    --rm-url https://cloud-ttp-us.bytedance.net/release_manager/pipeline/<svc>/release/<release-id>

# 标记关联 MR / 关联 release
bytedcli holmes code-review update --ticket-id 76617 \
    --related-mr https://code.byted.org/<repo>/merge_requests/<id> --related-release

# 兜底:直接传任意 check_input JSON
bytedcli holmes code-review update --ticket-id 76617 \
    --check-input '{"rm_tested":{"rm_url":""},"related_release":{"related_mr":"","related_release":false}}'
```

Selector 三选一:`--ticket-id <id>`、`--url <mr_or_holmes_url>`、`--repo <path> --mr-id <n>`。至少要传一个可改字段(否则 CLI 直接报错);`--idcs` 用逗号分隔。`--change-type` 取值参考 `holmes code-review enums` 的 `Change Types` 列表(`release_manager_tested` / `launch` / `revert` / `gurantee_no_metric_change` / `new_code_protected_by_ab_switch` / ...)。**注意**:`gurantee_no_metric_change` 是 Holmes 服务端 enum 的真实拼写(原文就漏了一个 `a`),不要写成 `guarantee_*`,否则服务端会拒绝。

### API 底层端点

- `GET /api/v3/code_review/openapi/mr_ticket_meta_status?gitlab_repo_name=<repo>&mr_id=<n>` — ticket header
- `GET /api/v3/code_review/ticket/<ticket_id>/check_info` — checks 分组
- `GET /api/v3/code_review/enum_value` — change_type / ticket_status 等枚举说明
- `PATCH /api/v3/code_review/ticket/<ticket_id>` — 更新 ticket(`change_type` / `idcs` / `global_inconsistent_reason` / `check_input`);bytedcli 总是把 `need_agent_sync: null` 一起送回去,匹配 web UI 行为

认证走 BDSSO CAS,和 TrustPress 一样,需要 `bytedcli auth login --session` 建立 SSO session。
