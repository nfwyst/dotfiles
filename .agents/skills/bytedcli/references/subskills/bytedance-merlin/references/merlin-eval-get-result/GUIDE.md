---
name: merlin-eval-get-result
description: 获取评估实例的指标结果或查看少量 case 级别明细数据。当需要查看 metrics（如 accuracy、invalid_rate）时使用。触发词：获取评估结果、get result、evaluation metrics、评估指标、exercise result、查看评估结果、评估得分、查看 metrics、case 明细（仅分页查看）。如果用户需要导出评估明细/批量导出全量 case 到文件/下载链接，应优先使用 `merlin-eval-result-export` skill。即使用户没有明确说"get result"，只要涉及查看评估指标，都应使用本 skill。
---

# 获取 Exercise 评估结果

通过 `bytedcli merlin exercise get-result` 获取汇总指标（metrics）。

## 前置条件

- `bytedcli merlin` 已安装并完成认证：

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

如果遇到 401/403 认证错误，运行 `bytedcli auth login` 重新登录。

- 目标评估实例已完成（状态为 DONE）

## 获取汇总指标

支持三种查询方式（互斥）：

### 1. 按实例 SID 查询（推荐）

```bash
bytedcli merlin exercise get-result --sid '<instance_sid>'
```

### 2. 按 Merlin Job Run ID 查询

```bash
bytedcli merlin exercise get-result --job-run-id '<job_run_id>'
```

### 3. 获取最新完成的运行

```bash
bytedcli merlin exercise get-result --exercise-version-sid '<exercise_version_sid>' --latest
```

参数较多时先运行 `bytedcli merlin exercise get-result --schema`，再按字段传 `--kebab-case` option；object/array 字段传 JSON-valued option。

### 参数说明

| 参数 | 说明 | 必填 |
|------|------|------|
| `sid` | 评估实例 SID | 三选一 |
| `job_run_id` | Merlin Job Run ID | 三选一 |
| `exercise_version_sid` | Exercise Version SID（配合 `latest` 使用） | 三选一 |
| `latest` | 设为 `true` 时返回最新的 DONE 状态运行 | 否 |

查看完整参数 schema：`bytedcli merlin exercise get-result --schema`

### 输出格式

命令返回 JSON，包含实例信息和所有 metrics：

```json
{
  "instance_sid": "<instance_sid>",
  "exercise_sid": "<exercise_sid>",
  "exercise_version_sid": "<exercise_version_sid>",
  "status": "DONE",
  "verified_models": ["<model_sid>"],
  "creator": "<username>",
  "created_at": "2026-03-09T10:53:00Z",
  "metrics": [
    {"metric_name": "avg_accuracy", "metric_value": "0.8723"},
    {"metric_name": "invalid_rate", "metric_value": "0.0186"}
  ],
  "errors": null
}
```

> 注意：`metric_value` 为字符串类型，向用户展示时建议转为数值并保留 4 位小数。

### 输出字段

| 字段 | 说明 |
|------|------|
| `instance_sid` | 评估实例 ID |
| `status` | 实例状态（`DONE` / `FAILED`） |
| `verified_models` | 被评估的模型 SID 列表 |
| `metrics` | 指标列表，每项含 `metric_name` 和 `metric_value`（字符串） |
| `errors` | 错误列表（`error_type` + `error_count`），无错误时为 `null` |
| `creator` | 创建者用户名 |
| `created_at` | 创建时间 |

具体的 metric 名称取决于 exercise 类型，不同 exercise 会有不同的指标。

## 解读与展示结果

向用户展示评估结果时：

1. **汇总指标**：将 `metrics` 中的关键指标（如 `avg_accuracy`）格式化为百分比或小数展示
2. **评估实例链接**：附上 Seed 平台链接供用户查看详情
3. **错误信息**：若 `errors` 非空，列出错误类型和数量
4. **FAILED 状态**：如果 `status` 为 `FAILED`，提示用户检查 Grafana 日志（通过 `merlin-recipe-eval-run` 的 `list-runs` 获取 `grafana_url`）

## 评估实例地址

评估实例可在 Seed 平台 Exercise 详情页的「运行记录」中查看：

```
https://seed.bytedance.net/evaluation/exercise/<exercise_sid>?version_sid=<exercise_version_sid>
```

## 查询 Case 级别明细

通过 `bytedcli merlin exercise list-cases` 查询 Exercise Version 的数据明细。内部两步执行：先获取 Exercise Version 的 DataCard 仓库信息，再从 Iceberg 表读取数据，支持分页。

```bash
bytedcli merlin exercise list-cases --exercise-version-sid ahfavsd29r663a3001 --limit 20 --offset 0
```

### 参数说明

| 参数 | 说明 | 必填 | 默认值 |
|------|------|------|--------|
| `exercise_version_sid` | Exercise Version SID | 是 | - |
| `limit` | 每页返回条数 | 否 | 20 |
| `offset` | 分页偏移量 | 否 | 0 |

查看完整参数 schema：`bytedcli merlin exercise list-cases --schema`

### 输出格式

```json
{
  "exercise_name": "数学_求导",
  "version_name": "PT_fewshot_v3",
  "columns": ["prompt", "answer", "__internal_uuid__", "__internal_tags__"],
  "rows": [
    {
      "prompt": "已知函数 f(x)=5x^3-7x, 求f(x)的导数",
      "answer": "-7 + 15 x ^ 2",
      "__internal_uuid__": "fdeb45c5-5b0b-4605-87a5-9a0afdd9ad05",
      "__internal_tags__": null
    }
  ],
  "total_count": 100,
  "limit": 20,
  "offset": 0
}
```

| 字段 | 说明 |
|------|------|
| `exercise_name` | Exercise 名称 |
| `version_name` | Version 名称 |
| `columns` | 数据列名列表（取决于 exercise 数据表结构） |
| `rows` | 行数据，每行为 column→value 的对象 |
| `total_count` | 数据总行数 |

> 具体的列名取决于 exercise 数据表结构，常见列包括 `prompt`、`answer`、`__internal_uuid__` 等。

> 如需批量导出全量 case 数据到文件（TOS JSON / 飞书表），应优先使用 `merlin-eval-result-export` skill（后台导出任务）；备选路径为 `merlin-arena` skill 的分页脚本。

## 查询评估结果 Case 明细（Arena）

通过 `bytedcli merlin merlin-arena list-case` 获取评估完成后的 case 级别结果数据。与 `exercise list-cases`（读取 exercise 原始数据）不同，此命令返回的是评估运行后每个 case 的模型回复、评分和指标详情。

```bash
bytedcli merlin merlin-arena list-case \
  --exercise_version_sid xgtczhbiilafstchyu \
  --evaluation_instance_sid ull7l31ew66954debe \
  --limit 20
```

### 参数说明

| 参数 | 说明 | 必填 | 默认值 |
|------|------|------|--------|
| `exercise_version_sid` | Exercise Version SID | 是 | - |
| `evaluation_instance_sid` | 评估任务 SID（Seed 平台 URL 中的 `evaluation_task_sid`） | 是 | - |
| `limit` | 每页返回条数 | 否 | 100 |
| `offset` | 分页偏移量 | 否 | 0 |

也支持 `--json` 传参：`bytedcli merlin merlin-arena list-case --exercise-version-sid ... --evaluation-instance-sid ...`

查看完整参数 schema：`bytedcli merlin merlin-arena list-case --schema`

### 如何获取 evaluation_instance_sid

从 Seed 平台 Exercise 详情页 URL 中提取 `evaluation_task_sid` 参数：

```
https://seed.bytedance.net/evaluation/exercise/<exercise_sid>?evaluation_task_sid=<这个值>&exercise_version_sid=...
```

### 输出格式

```json
{
  "case": [
    {
      "question_id": "e48e84ca-effe-42ab-9c70-9f18ba215955",
      "evaluation_instance_sid": "ull7l31ew66954debe",
      "exercise_version_sid": "xgtczhbiilafstchyu",
      "titan_model_sid": "xl9t1o8zxf65b7239d",
      "payload": "{\"score_0\": 0, \"predict_0\": \"模型回复...\", \"answer\": [\"2009\"], ...}"
    }
  ],
  "count": 10,
  "is_multi_turn": false
}
```

| 字段 | 说明 |
|------|------|
| `case[].question_id` | 题目 ID |
| `case[].evaluation_instance_sid` | 评估任务 SID |
| `case[].titan_model_sid` | 被评估的模型 SID |
| `case[].payload` | 评估结果详情（JSON 字符串），包含 score、predict、answer 等 |
| `count` | 总 case 数 |
| `is_multi_turn` | 是否为多轮评估 |

> `payload` 为 JSON 字符串，需要解析后使用。具体字段取决于 exercise 类型和评估配置，常见字段包括 `score_0`（评分）、`predict_0`（模型回复）、`answer`（标准答案）等。

## 完整工作流示例

```bash
# 1. 发起评估（参见 merlin-recipe-eval-run）
bytedcli merlin exercise run --exercise-sid '<exercise_sid>' --exercise-version-sid '<exercise_version_sid>' --verified-models '["<model_sid>"]' --evaluation-task-conf '{"param_mode":"GREEDY"}'
# 返回: {"instance": {"sid": "<instance_sid>", ...}}

# 2. 获取评估指标（评估完成后）
bytedcli merlin exercise get-result --sid '<instance_sid>'

# 或获取该版本最新完成的结果
bytedcli merlin exercise get-result --exercise-version-sid '<exercise_version_sid>' --latest

# 3. 查看 exercise 原始数据
bytedcli merlin exercise list-cases --exercise-version-sid '<exercise_version_sid>' --limit 50

# 4. 查看评估结果 case 明细（需要 evaluation_task_sid）
bytedcli merlin merlin-arena list-case \
  --exercise_version_sid <exercise_version_sid> \
  --evaluation_instance_sid <evaluation_task_sid> \
  --limit 20
```

## 常见问题

| 现象 | 原因和处理 |
|------|-----------|
| `instance not found` | SID 拼写错误或实例不存在，使用 `merlin-recipe-eval-run` 的 `list-runs` 确认正确的 SID |
| `instance is not in DONE status` | 评估尚未完成，等待状态变为 DONE 后再查询；可通过 `list-runs` 查看当前状态 |
| `latest` 查询无结果 | 该 Exercise Version 下没有 DONE 状态的运行，改用具体的 `sid` 查询 |
| 401 / 403 认证错误 | 运行 `bytedcli auth login` 重新登录 |
| `list-cases` 返回空 | 确认 `exercise_version_sid` 正确；该 exercise version 的 DataCard 表可能尚未写入数据 |
| `list-cases` 报 warehouse 为空 | 该 exercise version 没有关联 DataCard 仓库，可能是纯 Arena 类型评估 |
| `merlin-arena list-case` 返回 count=0 | 确认 `evaluation_instance_sid` 是 Seed 平台 URL 中的 `evaluation_task_sid`，不是 exercise instance SID |
| `export-result` 报错 FlightSQL | `bytedcli merlin` 暂不支持全量流式导出，推荐使用 `merlin-eval-result-export` skill 后台导出任务；或用 `list-cases`/`merlin-arena list-case` 分页查询 |
| metrics 为空 | 评估实例可能 FAILED 或评估代码未正确输出指标，检查 `status` 和 `errors` 字段 |

## 相关 Skills

- **前置**: `merlin-recipe-eval-run` — 运行评估、查看运行状态
- **下一步**: `merlin-recipe-eval-collection` — 将 Exercise 组装成 Collection
- **导出明细**: `merlin-eval-result-export` — Arena 评估 case 明细后台导出任务（全量导出首选）
- **Arena 数据拉取**: `merlin-arena` — Arena 评估概览、分页 list-case、失败排查
