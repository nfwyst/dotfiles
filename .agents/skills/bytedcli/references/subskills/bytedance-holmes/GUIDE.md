---
name: bytedance-holmes
description: "Manage Holmes TrustPress tasks, TrustData SQL queries, TrustData sql-submit --wait result polling, TrustData annotation/table registration follow-up, ByteCore C++ coredump analysis, and code-review ticket info via bytedcli. Invoke when tasks mention TrustPress、TikDiff、压测任务、Holmes、trust-press、tanker ID、创建压测、查可用 pod、压测结果查询、TrustData、数据质量、SQL 查询、trust-data、sql-submit --wait、result polling、annotation_required、table_register_required、table registration、注册表、ByteCore、coredump、崩溃分析、crash dump、SIGSEGV、frames_hash_id、code-review、ticket-detail、Change Type、MR Checks."
---

# bytedcli Holmes

## 工具适用场景

- 在本地电脑上使用 bytedcli 访问 CN 和 RoW 的 Holmes 工具
- 在 CN CloudIDE 上使用 bytedcli 访问 CN Holmes 工具
- 暂不支持在 CN CloudIDE 访问 RoW Holmes 工具

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

## Authentication

抖音业务线与 TikTok 业务线用户认证鉴权上有差异，需要注意区分。

### 抖音业务线认证

```bash
bytedcli auth login --session
```

扫码完成后，后续命令会自动通过 `sso.bytedance.com` 完成 CAS 认证，无需重复操作。
在 CN CloudIDE 上没有浏览器可用，可以手动复制浏览器 cookie 设置环境变量 `export BYTEDCLI_HOLMES_COOKIE="<cookie>"`。

### TikTok 业务线认证

```bash
bytedcli --site i18n auth login --session --session-method interactive-browser
```

## When to use

### TrustPress

- 查询 TrustPress 压测任务详情（任务类型、创建人、成功/失败数、成功率等）
- 获取压测任务的 Test Parameters（AB 参数、方法配置）
- 通过 tanker ID 查看压测结果
- 创建 TrustPress deploy-mode 压测任务
- 列出指定服务的可用 pod（空闲实例）

### TikDiff

- 创建 TikDiff 引流、压测、diff 任务：
  - 1）引流到指定 CloudIDE IP:Port；
  - 2）基于 SCM 版本/Git branch 分支/Git commit 等创建引流任务，在远程自动编译、部署服务后自动引流一条龙；
- 查询 TikDiff 引流、压测、diff 任务的报告详情；
- 上述引流任务创建既支持单机引流，又支持多机引流或多实例部署引流

### ByteCore

- **C++ coredump 聚合查询**（`holmes bytecore search --psm <psm>`）：当线上出现崩溃（SIGSEGV / OOM / 其它 signal）时，按 `frames_hash_id` 聚合同类崩溃，查看各独立签名的发生次数、涉及的 version / idc / cluster / env、崩溃调用栈、LLM 归因结论。支持按 `--env / --cluster / --version / --idc / --zone / --signum / --reason` 等维度过滤，`--with-frames` 可带回完整调用栈。需要 BDSSO session（首次使用先 `bytedcli auth login --session`）。

### TrustData

- **数据质量查询与 SQL 执行**（`holmes trust-data sql-submit`）：向 TrustData 提交 ClickHouse 或 Hive SQL 查询，TrustData API 默认走 i18n Holmes 后端，输出可直接打开的 i18n TrustData 控制台 URL。支持 `--sql` 直接传 SQL 或 `--sql-file` 从文件读取（避免 shell 转义问题）。CLI 会从 SQL 的 `FROM`/`JOIN` 中识别完整表名（如 `db.table`），先调用 i18n `get_table_info` 查询活跃表元数据并自动确定 `region`；如果只命中一个活跃 region，会自动带该 region 提交。`--region` 可手动覆盖自动检测。CLI 不要求用户传 `--repo-id` 或 `--data-source-type`；后端会以 BytedCLI platform 识别请求，并在缺省 repo_id 时自动创建/关联 CLI 查询使用的 repo。
- **表名或 region 冲突处理**：如果 `get_table_info` 返回多个活跃 region，交互式终端会提示用户选择 region 后继续提交；JSON/非 TTY 模式会返回 `HOLMES_TRUSTDATA_REGION_AMBIGUOUS` 错误并要求用 `--region` 重跑（推荐语义值：`us-ttp`、`eu-ttp`、`va`、`eu-ttp-no`、`us-ttp2`；兼容旧数字 1/2/3/4/5）。CLI 只用元数据确定 submit region，不改写 SQL；如果候选 region 超过一个，提交和结果输出会展示本次实际使用的 selected region，避免把不同 region 的结果混淆。提交到某个 region 后若查询失败，默认停止并报告失败 task/URL；Agent 不要自动尝试其他 region，必须先询问用户是否要换 region 重跑。
- **Annotation required 流程**：若后端判定 SQL 涉及未标注字段或表达式，`sql-submit` 输出 `annotation_required`、`annotation_url`、`annotation_meta`、`encoded_annotation_meta`。CLI 会直接尝试打开浏览器；用户文本模式还会展示可点击的 OSC 8 terminal hyperlink，JSON 模式仍保持 stdout 为纯 JSON，可直接读取 `annotation_url` 给上层 Agent/脚本。标注表单由 TrustData 前端基于后端返回的 encoded metadata 预填。
- **Table registration required 流程**：若后端判定 SQL 涉及未注册表（`code=100008`），`sql-submit` 输出 `table_register_required`、`table_register_url`、`new_table_name`。CLI 只使用后端返回的第一个缺失表名生成 `/trust-data/annotation/table-register?table_name=<name>&modal=1` 深链，并会直接尝试打开浏览器；用户文本模式还会展示可点击链接，JSON 模式仍保持 stdout 为纯 JSON，可读取 `table_register_url` 交给上层 Agent/脚本。
- **提交后等待结果**：Agent/脚本需要直接拿结果时，可以使用 `bytedcli --json holmes trust-data sql-submit --sql-file <file> --wait`。JSON 模式不会关闭 TrustData 的自动能力：提交前 region preflight、`--wait` 轮询都会继续执行；只是 stdout 保持纯 JSON，且不会自动打开浏览器。CLI 会在提交成功并拿到 `task_id` 后调用 result API 轮询查询结果，默认每 5 秒请求一次、最长等待 3 分钟；可用 `--poll-interval-ms 5000` 明确间隔，用 `--wait-timeout-ms <ms>` 控制最长等待。成功时从 JSON 读取 `data.result.rows`/`columns`，并在回复用户时渲染成表格；不要把单行结果只拼成纯文本值。用户直接在终端运行且未传 `--json` 时，CLI 自身会把查询结果渲染成表格。result API 偶尔会在查询刚提交后短暂返回 `failed`/`unknown`，CLI 需要至少 15 秒且连续确认失败后才停止；超时仍 pending/running/unknown 时 JSON status 为 `running` 且带 `message`，请用户打开 `data.url` 对应的 TrustData 页面检查进度，也可继续用 `sql-result --task-id <task_id>` 查询。若返回 `annotation_required` 或 `table_register_required`，不会轮询结果，先按对应 follow-up URL 处理。
- **查询结果获取**（`holmes trust-data sql-result`）：根据 task_id 拉取查询结果，自动解析 `data_source` JSON 为行列结构，`--limit` 控制展示行数；CLI 会在 API 请求中自动传默认 `data_source_type`，用户不需要提供该参数。
- **查询历史**（`holmes trust-data sql-history`）：获取最近的 SQL 查询历史记录，可用于找回 task_id 或确认提交记录。
- **表与字段信息**：`holmes trust-data list-tables --active-only` 列出已注册活跃表及 region/active 状态；`holmes trust-data table-info --table-name <table>` 调用 i18n `get_table_info` 查询提交元数据（region、data_source_type 等），适合排查同名表冲突；`holmes trust-data fields --table-info <table>` 查询字段、类型、是否已标注及描述。若 `fields` 无法仅凭表名解析完整元数据，先用 `list-tables` 找到表名、cluster、table_type、region、data_id/channel_id 等信息，再把完整 JSON 作为 `--table-info` 传入。
- **Repo 详情**（`holmes trust-data repo`）：根据 repo_id 或 query_id 获取 TrustData 仓库详情及关联查询。`sql-submit` 不需要显式 repo_id；如需排查后端自动创建/关联的 repo，可从历史、任务 URL 或 query_id 反查 repo 信息。
- **文件夹树**（`holmes trust-data folder-tree`）：列出 TrustData 文件夹目录结构，支持 `--folder-id` 指定根目录和 `--exclude-folder-id` 排除目录。

### Code Review

- **MR code-review ticket 信息**（`holmes code-review get --url <mr_url>`）：从 GitLab MR URL 一步拿到 Holmes ticket 的 Change Type、Ticket Status、Reviewers、IDCs、以及分组 Checks（diff / release_manager_tested / compatibility / other）的状态表;blocking failure 单独高亮。对应页面 `https://holmes.tiktok-row.net/code-review/ticket-detail`。同时支持 `--repo <group/project> --mr-id <n>` 和 `--no-include-checks`(只拉 header)。

## Quick start

### TrustPress

```bash
# 查看压测任务详情
bytedcli holmes trust-press get --tanker-id 106092

# 列出可用 pod
bytedcli holmes trust-press pod list --service-name <svc> --region ttp

# 创建压测任务（branch 模式，pod 参数省略时交互选择）
bytedcli holmes trust-press create \
  --service-name <svc> --region ttp --qps 10 --branch master

# 创建压测任务（SCM 版本模式）
bytedcli holmes trust-press create \
  --service-name <svc> --region ttp --qps 10 --scm 2.0.4.7452

# 创建压测任务（commit 模式）
bytedcli holmes trust-press create \
  --service-name <svc> --region ttp --qps 10 --commit 9bbd0ad41137f9fa82430e860c8d9236bb00b433

# JSON 输出（适合脚本消费）
bytedcli --json holmes trust-press get --tanker-id 106092
                               # 查可用 change_type 等枚举
```

### TikDiff

```bash
# 创建引流、压测、diff 任务
bytedcli holmes tikdiff create --case-id 2 --endpoints '[fd00:ffff:ffff:69::7a]:8080' # for CN Holmes TikDiff
bytedcli --site i18n holmes tikdiff create --case-id 1 --endpoints '[fdbd:dccd:cde2:1701:d425:bcd6:c169:ae25]:53085' # for RoW Holmes TikDiff

bytedcli --json holmes tikdiff get --task-id 2493426  # for CN Holmes TikDiff
bytedcli --json --site i18n holmes tikdiff get --task-id 2503983 # for RoW Holmes TikDiff

```

### ByteCore

```bash
# 查看 ByteCore 聚合查询结果
bytedcli holmes bytecore search --psm aweme.recommend.feed_rank
bytedcli --site i18n holmes bytecore search --psm tiktok.recommend.sort_cpp
```

### TrustData

```bash
# 提交 SQL 查询；TrustData API 默认走 i18n Holmes，CLI 会先用 get_table_info 自动确定 region，不要求 repo_id
bytedcli holmes trust-data sql-submit \
  --sql "SELECT count(*) FROM example_db.example_table WHERE p_date = '2026-04-01'"

# 从文件读取 SQL；若 JSON/非 TTY 模式提示 region 歧义，可用 --region 消歧
bytedcli holmes trust-data sql-submit --sql-file ./query.sql --region us-ttp

# JSON 模式适合 Agent/脚本：不会关闭 preflight 或 --wait 轮询，但不会自动打开浏览器
# 成功时读取 data.result.rows 并在回复用户时渲染成表格；需要标注/注册表时读取对应 URL
bytedcli --json holmes trust-data sql-submit --sql-file ./query.sql --wait --poll-interval-ms 5000

# 查询结果（task_id 可从 sql-submit 输出 URL 的 taskid 参数获取）
bytedcli holmes trust-data sql-result --task-id <task_id> --limit 50

# 查看查询历史
bytedcli holmes trust-data sql-history

# 列出所有活跃的 TrustData 表
bytedcli holmes trust-data list-tables --active-only

# 查询表字段
bytedcli holmes trust-data fields --table-info "example_db.example_table"

# 查询表提交元数据（region / data_source_type），用于排查同名表冲突
bytedcli holmes trust-data table-info --table-name "example_db.example_table" --active-only

# 若仅表名无法解析字段元数据，先 list-tables 获取完整 metadata，再以 JSON 传给 --table-info
bytedcli --json holmes trust-data list-tables --active-only
bytedcli holmes trust-data fields \
  --table-info '{"table_name":"example_db.example_table","cluster_name":"example_cluster","table_type":0,"region":"1","is_active":true}'

# 获取 repo 详情；sql-submit 通常不需要传 repo_id，后端自动处理
bytedcli holmes trust-data repo --repo-id <repo_id>
bytedcli holmes trust-data repo --query-id <query_id>

# 查看文件夹树
bytedcli holmes trust-data folder-tree

```

### CodeReview

```bash
# 查 code-review ticket + checks(Change Type、Reviewers、Checks 汇总)
bytedcli holmes code-review get --url https://code.byted.org/tiktok-plus/tiktok_sort/merge_requests/3984
bytedcli holmes code-review get --repo tiktok-plus/tiktok_sort --mr-id 3984
bytedcli holmes code-review get --url <mr_url> --no-include-checks   # 只要 header
bytedcli holmes code-review enums

# 修改 code-review ticket(change_type / 受影响 IDCs / 全局不一致原因 / check_input)
bytedcli holmes code-review update --ticket-id 76617 --idcs ttp \
    --change-type release_manager_tested --global-inconsistent-reason US
bytedcli holmes code-review update --url <mr_url> \
    --idcs i18n,ttp,i18n_sg,i18n_va,i18n_gcp \
    --change-type release_manager_tested --global-inconsistent-reason US
bytedcli holmes code-review update --ticket-id 76617 --rm-url https://cloud-ttp-us.bytedance.net/release_manager/pipeline/...
```

## Notes

- `--tanker-id` 对应 TrustPress 页面 URL 中的 `tankerId` 参数。
- 认证通过 BDSSO CAS 流程自动完成，需要先执行 `bytedcli auth login --session` 获取 SSO session；或通过 `BYTEDCLI_HOLMES_COOKIE` 环境变量注入 cookie。
- `get` 输出包含 Task Type、Task ID、Service Name、Creator、Create/Start/End Time、**Task State**（从 `display_status`/`state`/`execute_state` 推导，例如 `Stopped/Failed` / `Running` / `Completed`）、Success/Failure Count、Success Rate 和 Test Parameters；当任务有 orchestrator 级错误时（`error_msg` 非空 或 `state=3`），会以 `⚠ Error` 行高亮错误信息，避免读者只看 metric counts 而漏掉任务本身已失败这件事。
- **Success Rate 边界**：当后端只发了 `throughput` 但没有 `success:*` 也没有 `resp.error:*` 时（数据不完整），CLI 显示 `Unknown` 而不是假装 100%（这是个真实存在的 bug，先前的旧版本会在这种情况下错报全部成功）；JSON 模式同样 `success_count: 0, failure_count: 0, success_rate: "Unknown"`。
- JSON 模式额外返回 `deploy_info`、`metric_counters`、`task_state`、`state`、`execute_state`、`display_status`、`orchestrator_error`、`error_msg`、`raw`。
- `create` 的 pod 参数（`--ip`/`--port`/`--instance-shard-id`/`--instance-name`）省略时在 TTY 中交互选择；非 TTY 场景（Agent、CI）需先运行 `pod list` 获取后显式传入。
- `create` 的部署版本必须三选一：`--branch <branch>`（branch 模式）、`--scm <version>`（SCM 版本模式，例如 `2.0.4.7452`）、`--commit <sha>`（commit 模式，传完整 commit SHA）。多传或都不传都会被拒绝。
- `pod list` 默认只显示空闲 pod，`--all` 显示全部。
- `code-review get` 接受 GitLab MR URL 或 Holmes ticket-detail URL，也可改用 `--repo <group/project> --mr-id <n>`；默认同时拉 `/openapi/mr_ticket_meta_status`（header）+ `/ticket/{id}/check_info`(checks)，加 `--no-include-checks` 只拉 header；JSON 模式里 `check_summary.by_status` 是状态计数,`check_summary.blocking_failures` 是 block=true 且 status 为 failed/error/timeout 的列表,`check_groups[].checks[]` 保留每条 check 的原始字段。
- `code-review update` 是 PATCH 操作（`PATCH /api/v3/code_review/ticket/<ticketId>`），对应 web 上「编辑 ticket」面板。Selector 三选一：`--ticket-id <id>`、`--url <mr_or_holmes_url>`、`--repo <path> --mr-id <n>`；至少要传一个可改字段（`--change-type` / `--idcs` / `--global-inconsistent-reason` / `--rm-url` / `--related-mr` / `--related-release` / `--check-input`）。`--idcs` 用逗号分隔（例 `ttp` 或 `i18n,ttp,i18n_sg,i18n_va,i18n_gcp`）；`--check-input <json>` 是兜底入口，传任意 JSON 对象覆盖 `check_input` 子树。`--change-type` 取值见 `holmes code-review enums`。
- TrustData API 默认走 i18n Holmes 后端，不需要额外传 `--site i18n`。`sql-submit` 参数说明：`--sql` 和 `--sql-file` 二选一，`--sql-file` 优先；CLI 请求体固定使用 BytedCLI platform，并默认让后端处理 `data_source_type` 与 repo 归属。`--repo-id` 和 `--data-source-type` 不是 submit 命令参数；缺省 repo_id 时，TrustData 后端会为 CLI 来源自动创建/关联 repo。CLI 会根据 SQL 中的 `FROM`/`JOIN` 完整表名调用 `get_table_info --active-only` 自动确定 region；多个活跃 region 时，交互式终端提示选择，JSON/非 TTY 模式返回 `HOLMES_TRUSTDATA_REGION_AMBIGUOUS`，需要显式传 `--region`。当候选 region 超过一个时，文本结果会展示本次实际使用的 selected region。`--region` 推荐取值：`us-ttp`、`eu-ttp`、`va`、`eu-ttp-no`、`us-ttp2`（兼容旧数字 1/2/3/4/5）。
- TrustData `sql-submit` 对提交阶段的 `HTTP 502 Bad Gateway` 会自动做简单重试，最多重试 2 次；若仍失败，再把 502 错误返回给用户。
- TrustData region fallback：当某个 region 的 `sql-submit` 已成功创建 task 但执行结果为 `failed`/`unknown`，Agent 必须停止并汇报 task_id、TrustData URL、已使用 region 与可选候选；不要自动尝试其他 region。只有用户明确要求继续，才可用另一个 `--region` 重跑同一 SQL。
- TrustData 表信息排查：用 `list-tables --active-only` 查看已注册表、region、active 状态；用 `table-info --table-name <table> --active-only` 查看 i18n `get_table_info` 返回的 submit metadata，包括 `region`、`region_name`、`data_source_type`、`data_source_type_name`；用 `fields --table-info <name-or-json>` 查看字段与 annotation 状态。`fields` 会尽量从表列表补全 cluster/table_type/region 等参数；如果表名不唯一或补全失败，传入包含 `table_name`、`cluster_name`、`table_type`、`region`、`is_active` 的 JSON。
- TrustData JSON 模式说明：Agent 使用 `--json` 是为了稳定解析结果，不会关闭 submit 前 region preflight 或 `--wait` 自动轮询；JSON 模式不会自动打开 annotation/table registration 浏览器，只返回对应 URL。唯一不会在 JSON/非 TTY 中进行的是交互式 region 选择，遇到 `HOLMES_TRUSTDATA_REGION_AMBIGUOUS` 后应读取候选并用 `--region` 重跑。成功查询结果应把 `data.result.columns` + `data.result.rows` 组织成表格回复用户。
- TrustData annotation required：若 `sql-submit` 返回 `annotation_required`，CLI 输出可打开的 `annotation_url`；文本模式会尝试自动打开浏览器并额外展示 OSC 8 terminal hyperlink。JSON 模式保持 stdout 为纯 JSON，不打开浏览器。由 TrustData 前端承接 encoded metadata 并完成标注表单。
- TrustData table registration required：若 `sql-submit` 返回 `table_register_required`，CLI 输出可打开的 `table_register_url` 和 `new_table_name`；文本模式会尝试自动打开浏览器并额外展示 OSC 8 terminal hyperlink。JSON 模式保持 stdout 为纯 JSON，不打开浏览器。由 TrustData 前端通过 `table_name` 和 `modal=1` 打开注册表单。
- TrustData submit-and-wait：需要提交后直接拿查询结果时使用 `sql-submit --wait`。CLI 会在成功提交并拿到 task_id 后轮询 `sql-result`，默认 5 秒一次，最长 3 分钟；若超时仍 pending/running，JSON status 为 `running` 且带 `message`，请用户打开返回的 TrustData URL 检查进度，也可继续用 `sql-result --task-id <task_id>` 查询。
- TrustData `sql-result` 在 `task_status=3` 时表示查询失败，可能是 SQL 超时或语法错误；建议简化查询或缩短时间范围后重试。
- TrustData 页面 URL 中的 `taskid` 即 CLI `sql-result` 的 `--task-id`。

## References

- [holmes.md](./references/holmes.md)
- [invocation.md](./references/invocation.md)
- [troubleshooting.md](./references/troubleshooting.md)
