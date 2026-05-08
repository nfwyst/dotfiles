---
name: merlin-recipe-eval-run
description: 在 Exercise Version 上运行评估。当需要对已创建的 Exercise 执行模型评估、发起评估任务、查看评估运行状态、获取评估结果时使用。触发词：运行评估、run evaluation、exercise run、评估实例、evaluation instance、list runs、发起评估、跑评估、启动评估、评估任务运行、get result、评估结果。即使用户没有明确说"run"，只要涉及对 Exercise 发起模型评估、查看评估状态或获取评估结果，都应使用本 skill。
---

# 运行 Exercise 评估

通过 `bytedcli merlin exercise run` 对已有的 Exercise Version 发起评估，通过 `bytedcli merlin exercise list-runs` 查看运行状态，通过 `bytedcli merlin exercise get-result` 获取评估结果。

## 前置条件

- `bytedcli merlin` 已安装并完成认证：

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

如果遇到 401/403 认证错误，运行 `bytedcli auth login` 重新登录。

- 目标 Exercise 和 Exercise Version 已创建（参见 `merlin-recipe-eval-exercise-setup` skill）

## 发起评估

```bash
bytedcli merlin exercise run --exercise-sid '<exercise SID>' --exercise-version-sid '<exercise version SID>' --hdfs-config-items '[{"hdfs_path":"hdfs://path/to/model/checkpoint","display_name":"my-model-v1"}]'
```

参数较多时先运行 `bytedcli merlin exercise run --schema`，再按字段传 `--kebab-case` option；object/array 字段传 JSON-valued option。

### 必须由用户提供的参数（禁止猜测）

| 参数 | 说明 | 为什么不能猜 |
|------|------|------------|
| `exercise_sid` | Exercise 的 SID | 用户指定要评估的 Exercise |
| `exercise_version_sid` | Exercise Version 的 SID | 用户指定要评估的版本 |
| `hdfs_config_items` 或 `verified_models` | 模型 checkpoint 路径或已注册模型 SID | 模型路径因实验而异，错误路径会导致评估失败且浪费资源 |

### 模型指定（二选一）

| 参数 | 说明 |
|------|------|
| `hdfs_config_items` | HDFS checkpoint 列表，每项含 `hdfs_path` 和 `display_name` |
| `verified_models` | 已注册模型的 SID 列表 |

### 评估任务配置（evaluation_task_conf）

通过 `evaluation_task_conf` 配置评估行为。最常用的字段：

| 字段 | 说明 | 可选值 |
|------|------|--------|
| `param_mode` | 解码参数模式 | `DEFAULT`, `GREEDY`, `BO5`, `CUSTOM` |
| `max_samples` | 最大评估样本数（调试时限制样本量） | 整数 |
| `system_prompt` | 系统提示词 | 字符串 |
| `resource` | 自定义资源队列（见下方说明） | object |

> **⚠️ 使用自定义资源需要用户确认**：`evaluation_task_conf.resource` 涉及团队资源配额，agent 不得自行填写。必须向用户确认具体的资源组（`group_id`）和集群（`cluster_id`）后再传入。如果用户没有主动指定资源，一律不传 `resource`，由平台自动分配。

resource 结构：

```json
"resource": {"group_id": <group_id>, "cluster_id": <cluster_id>, "queue_name": "default"}
```

更多高级配置（`model`、`inference_engine`、`precompute_source`、`env`、`extra_flags` 等）参考 `references/evaluation-task-conf.md`。

查看完整参数 schema：`bytedcli merlin exercise run --schema`

## 查看评估运行

```bash
bytedcli merlin exercise list-runs --exercise-sid '<exercise_sid>' --exercise-version-sid '<exercise_version_sid>' --limit 10
```

`exercise_version_sid` 是必须的（不传会导致后端查询超时），`exercise_sid` 强烈建议同时传入。其他过滤字段：`stage`、`creator`、`limit`（默认 20）、`offset`（默认 0）。按单个实例查询时可以只传 `sid` 或 `job_run_id`。

查看完整参数 schema：`bytedcli merlin exercise list-runs --schema`

## 获取评估结果

```bash
bytedcli merlin exercise get-result --sid '<instance SID>'
```

也支持通过 `job_run_id` 或 `exercise_version_sid`（配合 `latest: true` 获取最新已完成的结果）查询。返回实例信息及评估指标（metrics）。

## 完整示例

```bash
# 1. 发起评估（GREEDY 模式，限制 50 条样本用于调试）
bytedcli merlin exercise run --exercise-sid '<exercise_sid>' --exercise-version-sid '<exercise_version_sid>' --hdfs-config-items '[{"hdfs_path":"hdfs://example-cluster/home/sample/<your_path>/merlin-checkpoints/step_1000","display_name":"step-1000"}]' --evaluation-task-conf '{"max_samples":50,"param_mode":"GREEDY"}'
# 返回: {"instance": {"sid": "<instance_sid>", "status": "WAITING", "job_run_id": "<job_run_id>", ...}}

# 2. 查看运行状态
bytedcli merlin exercise list-runs --exercise-sid '<exercise_sid>' --limit 5

# 3. 获取评估结果（评估完成后）
bytedcli merlin exercise get-result --sid '<instance_sid>'
```

## 解读运行结果

发起评估后返回的 JSON 关键字段：

| 字段 | 说明 |
|------|------|
| `instance.sid` | 评估实例 ID，用于后续查询状态和结果 |
| `instance.status` | 当前状态（见下方状态流转） |
| `instance.job_run_id` | Merlin 任务 ID，可用于 `list-runs` 过滤 |
| `instance.grafana_url` | Grafana 监控链接，可分享给用户查看实时日志 |
| `instance.job_address` | 任务详情页地址 |

`get-result` 返回的额外字段：

| 字段 | 说明 |
|------|------|
| `metrics` | 评估指标列表（`metric_name` + `metric_value`） |
| `errors` | 评估错误列表（`error_type` + `error_count`） |

向用户展示结果时，重点呈现：评估实例 URL、状态、以及完成后的 metrics。失败时附上 `grafana_url`。

## 状态流转

评估实例的生命周期：`WAITING` → `RUNNING` → `DONE`（成功）或 `FAILED`（失败）。

评估任务通常耗时 10-60 分钟，视数据量和模型大小而定。使用 `max_samples` 限制样本量可以显著缩短调试时间。

## 评估实例地址

评估实例可在 Seed 平台 Exercise 详情页的「运行记录」中查看：

```
https://seed.bytedance.net/evaluation/exercise/<exercise_sid>?version_sid=<exercise_version_sid>
```

## 常见问题

| 现象 | 原因和处理 |
|------|-----------|
| 资源不足或排队超时 | 评估队列繁忙，可尝试使用自定义资源队列（需用户提供 `group_id`/`cluster_id`），或设置 `max_samples` 减少资源需求 |
| 模型 checkpoint 路径无效 | HDFS 路径不存在或无权限，检查路径拼写和访问权限 |
| `exercise_sid` 或 `exercise_version_sid` 无效 | SID 拼写错误或 Exercise 不存在，用 `merlin-eval-query` skill 查询正确的 SID |
| 401 / 403 认证错误 | 运行 `bytedcli auth login` 重新登录 |
| 评估 FAILED 但无明确错误信息 | 查看 `grafana_url` 中的实时日志定位问题；常见原因：模型格式不匹配、评估代码异常 |

## 相关 Skills

- **前置**: `merlin-recipe-eval-exercise-setup` — 创建 Exercise 和 Exercise Version
- **查询**: `merlin-eval-query` — 查询已有 Exercise 信息
