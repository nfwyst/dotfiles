---
name: merlin-tracking-experiment
description: 查询和分析 Merlin/Seed Tracking 实验数据的完整工具集：项目与 Run 管理、Metrics 列表与时序数据、Run 配置/摘要/标量曲线对比、实验图表面板、表格数据、Weave LLM/Agent 链路追踪、趋势分析。当用户说"查看 Tracking 指标/loss 趋势/训练曲线/实验图表/experiment panel/metrics 分析/指标对比/Run 配置/Run 摘要/标量曲线/表格数据/Weave 调用/Trace 追踪/项目列表/Run 列表"时使用。
---

# Tracking 实验与指标分析

查询和分析 Merlin Tracking 实验数据，包括项目与 Run 管理、Metrics 查询与对比、实验图表、表格数据、Weave 链路追踪、趋势分析。

## 前置条件

- `bytedcli merlin` 可用

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

如果出现认证错误（401/403），运行 `bytedcli auth login`。

---

## 1. 项目与 Run 管理

### 1.1 列出项目

分页列出当前用户可见的 Tracking 项目，可按名称、关键字、角色筛选。

```bash
bytedcli merlin tracking list-projects --keyword my-project --limit 20 --offset 0
```

可选参数：`name`（精确匹配）、`role`（`MyFavorite` / `MyInvolved` / `MyCreated`）、`is_public`（仅公开项目）、`lite_response`（精简字段）。

### 1.2 获取项目详情

获取单个项目的元数据与可见范围信息。

```bash
bytedcli merlin tracking get-project --project-id project_xxx
```

可选 `with_permission: true` 在响应中附带权限字段。

### 1.3 列出 Run

分页列出某个项目下的 Run（实验运行记录）。

```bash
bytedcli merlin tracking list-runs --project-id project_xxx --limit 20 --offset 0
```

可选参数：`keyword`（关键字搜索）、`run_ids`（限定 Run 列表）、`my_created`（仅自己创建的）、`order` / `order_by`（排序）、`filters`（字段过滤条件）。

### 1.4 获取 Run 详情

获取单个 Run 的配置、摘要、标签等详细信息。

```bash
bytedcli merlin tracking get-run --project-id project_xxx --run-id run_xxx
```

---

## 2. 指标查询

### 2.1 获取 Metrics 列表（通过 job_run_id）

查询任务关联的所有 Tracking Metrics。使用 `job_run_id` 参数（不要用 `project` 和 `experiment` 参数）。

```bash
bytedcli merlin tracking list-run-entities --job-run-id '<job_run_id>'
```

也可通过 `project_name_or_id` + `experiment_name_or_id` 定位（两组参数不要混用）。支持 `filters` 按名称子串/正则过滤，`page` / `page_size` 分页。

### 2.2 列出指标名称（通过 project_id + run_ids）

列出给定 Run 列表下的指标名称，常用于后续拉曲线或表格。

```bash
bytedcli merlin tracking list-run-entity-names --project-id project_xxx --run-ids '["run_xxx"]'
```

可选参数：`tab`（`user` 用户指标 / `system` 系统指标）、`types`（默认 `["scalar"]`）、`name_keyword`（名称关键字过滤）。

### 2.3 获取 Metrics 时序数据

针对关键 Metrics（loss、eval_loss、accuracy 等）获取详细时序数据。

```bash
bytedcli merlin tracking get-run-entity-step-auto --project-id project_xxx --run-id run_xxx --entity-name loss
```

返回 TOS URL 的 CSV 下载链接与元数据；若 TOS 失败则回退返回结构化 Series。优先使用 `run_id`，不要与已废弃的 `experiment_id` 同时填不同值。

### 2.4 获取 Run 配置项

按项目与 Run 列表读取配置项（config）键值。

```bash
bytedcli merlin tracking get-run-configs --project-id project_xxx --run-ids '["run_xxx"]'
```

`config_keys` 参数有三种语义：不传 = 省略字段（返回全部）；`null` = 显式 null；`[]` = 空数组。三种写法不同，请勿混用。

### 2.5 获取 Run 摘要

按项目与 Run 列表读取摘要（summary）指标键值。

```bash
bytedcli merlin tracking get-run-summaries --project-id project_xxx --run-ids '["run_xxx"]'
```

`summary_keys` 参数语义同 `config_keys`。

---

## 3. 标量曲线对比

获取多个 Run 的标量曲线数据，用于自定义图表和跨 Run 对比。

```bash
bytedcli merlin tracking get-run-scalar-chart --project-run-ids '[{"project_id":"project_xxx","run_id":"run_aaa","region":""},{"project_id":"project_xxx","run_id":"run_bbb","region":""}]' --x-axis '{"name":"_step"}' --y-axis '{"metrics":[{"name":"loss"}]}'
```

也可用 `project_id` + `run_ids` + `region` 代替 `project_run_ids`（二选一）。可选参数：`step_range`（step 区间 `{min, max}`）、`option`（去异常值 `remove_abnormal_value`、平滑 `smooth.ema` / `smooth.sma`）。

---

## 4. 实验图表（Experiment Insight）

### 4.1 获取 Experiment Group View

根据实验视图 SID 获取 Experiment Group View 详情。

```bash
bytedcli merlin tracking get-group-view --experiment-group-view-sid '<view_sid>'
```

### 4.2 搜索实验图表面板

查询实验图表基础信息，包括图表名称、x 轴范围、legends 列表。

```bash
bytedcli merlin tracking search-panel --insights '[{"insight_sid":"<insight_id>","experiment_group_sid":"<group_id>"}]'
```

每个 legend 是图表中一条线的唯一标识，可用于后续获取该线的详细数据。

### 4.3 获取图表时序数据

获取实验图表中特定 legend 的详细时序数据。

```bash
bytedcli merlin tracking get-timeseries --insight-sid '<insight_id>' --experiment-group-sid '<group_id>' --filters '{"legends":["<legend_id_1>","<legend_id_2>"],"step_range":[0,10000]}'
```

`legends` 和 `step_range` 通常直接复用 `search-panel` 返回的值。

---

## 5. 表格数据

### 5.1 列出 Run 的表格

列出给定 Run 下已上报的表格类实体。

```bash
bytedcli merlin tracking list-run-tables --project-id project_xxx --run-ids '["run_xxx"]'
```

可选参数：`name`（表名模糊过滤）、`limit` / `offset`（分页）。

### 5.2 获取表格行数据

读取单个 Run 中某张表格的分页行数据与列名。

```bash
bytedcli merlin tracking get-run-table-info --project-id project_xxx --run-id run_xxx --name '<table_name>'
```

`name` 须与 `list-run-tables` 返回的表名一致。可选参数：`limit` / `offset`（分页）、`order` / `order_by`（排序）、`filters`（列过滤条件）。

---

## 6. Weave 链路追踪

Weave 用于追踪 LLM/Agent 的调用链路，分析输入输出、执行状态和调用树。

### 6.1 列出 Weave Calls

列出符合条件的 Call 记录。

```bash
bytedcli merlin tracking list-weave-calls --project-id project_xxx --filter '{"trace_ids":["<trace_id>"]}'
```

`filter` 支持：`call_ids`、`trace_ids`、`thread_ids`、`start_time_from` / `start_time_to`（Unix 时间戳）。

### 6.2 获取单个 Weave Call

查询单个 Call 的详情（输入输出、状态等）。

```bash
bytedcli merlin tracking get-weave-call --project-id project_xxx --call-id '<call_id>'
```

可选 `start_date`（格式 `YYYY-MM-DD`）缩小检索范围。

### 6.3 获取 Weave Trace

查询某次 Trace 的调用树（根 Call 与子 Call 嵌套），用于分析 LLM/Agent 完整链路。

```bash
bytedcli merlin tracking get-weave-trace --project-id project_xxx --trace-id '<trace_id>'
```

可选参数：`sub_tree_root_call_id`（仅拉取以该 Call 为根的子树）、`time_range`（时间范围）、`external_region`（跨区场景）。

---

## 7. 趋势分析

下载 CSV 数据后，使用分析脚本进行趋势与波动分析：

```bash
python3 skills/bytedance-merlin/references/merlin-tracking-experiment/scripts/analyze_metrics_csv.py \
  loss_data.csv --state_dir ./metrics_state --metrics loss --smooth 21 --out ./loss_report.html
```

固定复用 `--state_dir` 支持增量分析，避免重复处理已分析区间。

---

## 脚本

| 脚本 | 路径 | 作用 |
|------|------|------|
| CSV 指标分析 | `scripts/analyze_metrics_csv.py` | 趋势与波动分析 + HTML 曲线图 |
| CSV 处理工具 | `scripts/csv_metrics_utils.py` | CSV 列裁剪与多文件拼接 |
| 旧版分析脚本 | `scripts/analyze_metrics.py` | 兼容用途 |

### 使用示例

```bash
# 输出摘要
python3 scripts/analyze_metrics_csv.py https://example.com/metrics.csv --metrics loss accuracy

# 生成可视化报告
python3 scripts/analyze_metrics_csv.py ./metrics.csv --out ./metrics_report.html --smooth 21

# 对比多个 run
python3 scripts/analyze_metrics_csv.py run1.csv run2.csv --metrics loss --out compare.html --ema 0.2

# CSV 列裁剪
python3 scripts/csv_metrics_utils.py select ./metrics.csv --columns step,loss,accuracy --out ./small.csv

# 拼接多个 run
python3 scripts/csv_metrics_utils.py concat run1.csv run2.csv --out ./all_runs.csv
```

---

## 常见工作流

### 从零开始查看某个任务的 loss 曲线

1. `list-run-entities` + `job_run_id` → 获取 Metrics 列表
2. `get-run-entity-step-auto` → 下载 loss 的 CSV 时序数据
3. `analyze_metrics_csv.py` → 生成趋势报告

### 跨 Run 对比指标

1. `list-projects` → 找到目标项目
2. `list-runs` → 列出项目下所有 Run
3. `get-run-scalar-chart` → 拉取多个 Run 的标量曲线数据并对比

### 查看 Run 的训练配置差异

1. `get-run-configs` 传入多个 `run_ids` → 批量获取配置
2. 对比不同 Run 的配置差异

### 分析 Weave LLM 调用链路

1. `list-weave-calls` → 找到目标 Call
2. `get-weave-trace` → 获取完整调用树
3. `get-weave-call` → 查看单个 Call 的输入输出细节

---

## 注意事项

- 使用 `tracking list-run-entities` 时，如果手头有 `job_run_id` 则优先使用该参数
- `get-run-configs` / `get-run-summaries` 中的 `config_keys` / `summary_keys` 参数有三种语义（不传/null/空数组），注意区分
- 如果某个指标获取失败，跳过并记录
- 关注异常波动（如 loss 突然上升）
- Weave 相关操作需要有效的 JWT 身份凭证

---

## 关联技能

- `job-monitor`（`seed/rd-skills`）：任务监控总调度
- `merlin-job-devops`：查看任务日志
