---
name: merlin-eval-result-export
description: Arena 评估任务：用 bytedcli merlin 后台「导出任务」生成整包 case 明细文件（TOS JSON / 飞书表），按 exercise 维度发起 create-eval-result-export-job、轮询 list-eval-result-export-job、交付 export_file_url。触发：导出到文件/下载链接/批量导出全量 case JSON、新版评估明细导出任务、evaluation_task_sid + 要可下载的明细文件、多 exercise 各一份导出。不要触发：仅查看前 N 条 case、分页 list-case、控制台里随便看一眼明细、只要汇总 metrics 不要文件、Exercise 非 Arena 的 get-result/list-cases。与 arena skill 分工：arena 用 list-case 或 fetch_arena_evaluation.py 分页拉取；本 skill 用导出任务产出一个（或每 exercise 一个）完整文件，数据量大时优先本 skill。
---

# Arena 评估 case 明细：后台导出任务（bytedcli merlin）

用 `bytedcli merlin arena` 的导出任务接口把 Arena 评估的 case 级明细写成文件。后台聚合比 `list-case` 分页更适合全量；全量场景优先走本流程，`arena` skill 里的脚本分页是备用路径。

## 前置条件

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

出现 401/403 时运行 `bytedcli auth login`。

---

## 何时用本 skill、何时不用

- **用本 skill**：用户要**可下载的完整明细文件**（TOS 链接、JSON 全量）、多个 exercise 各导一份、明确说「导出任务」「后台导出」「拉成文件」。
- **不要用本 skill**：只要**前几页 / 抽样 case** → 用 `arena` 的 `list-case` 或 `eval-get-result` 相关能力；只要**指标汇总** → `eval-get-result`；失败排查 → `arena` + `job-troubleshoot-failure`。

---

## 总流程

```
解析 evaluation_task_sid（与可选 exercise_version_sid）
  → support-new-eval-result
  → 若不支持：走下方「不支持新版明细」固定降级序列
  → 若支持：得到 exercise 列表（单个可跳过）
  → 每个 exercise：list 已有 job →（可选）get schema → 选列 → create job → 按需轮询
  → 汇总表格交付链接
```

---

## 步骤 1：解析输入

Seed 链接常见形式：

```text
https://seed.bytedance.net/evaluation/arena/<arena_sid>?evaluation_task_sid=<arena_evaluation_sid>&exercise_version_sid=<exercise_version_sid>
```

提取：

- **`arena_evaluation_sid`**：query 里的 `evaluation_task_sid`（与 `list-case` 里的 evaluation_instance_sid 是同一类 ID）；用户口头说的「评估任务 sid」默认指它。
- **`exercise_version_sid`**：可选。未给出则应对**该评估下全部 exercise** 逐个导出。

若只给了一个裸 SID 且未说明含义，默认当作 **`arena_evaluation_sid`**。

---

## 步骤 2：是否支持新版明细

```bash
bytedcli merlin arena support-new-eval-result --arena-evaluation-sids '["<arena_evaluation_sid>"]'
```

**响应示例（支持）：**

```json
{
  "supported": true,
  "ResponseBase": { "code": 0, "message": "" }
}
```

**响应示例（不支持）：**

```json
{
  "supported": false,
  "ResponseBase": { "code": 0, "message": "" }
}
```

- `supported: true`：继续本 skill 后续步骤。
- `supported: false`：**不要停在一句「去问 arena skill」**。按下面「不支持新版明细」完整执行降级命令序列。

---

## 不支持新版明细时的固定降级序列

后台导出不可用，改用 `arena` skill 的分页/脚本能力，按顺序做：

1. 拉评估结构（与后续脚本一致，确认 exercise 列表）：

```bash
bytedcli merlin arena get-evaluation --sid '<arena_evaluation_sid>'
```

2. 在用户工作目录执行全量 case 文件拉取（相对仓库根路径与 `arena` skill 一致）：

```bash
python3 skills/bytedance-merlin/references/merlin-arena/scripts/fetch_arena_evaluation.py \
  --url "<arena_evaluation_sid_or_full_seed_url>" \
  --out-dir "./arena_eval_export" \
  --fetch-cases \
  --max-exercises-for-cases 0
```

3. 向用户交付：`arena_eval_export/report.md` 摘要、`cases/*.jsonl` 路径说明，并说明**未使用** `create-eval-result-export-job`。

若无法运行脚本，再退化为：对每个 `exercise_version_sid` 循环调用 `bytedcli merlin arena list-case`，分页累加（见 `arena` skill），并明确告知这比导出任务慢、易超时。

---

## 步骤 3：得到要导出的 exercise 列表

已指定 `exercise_version_sid` 时：列表仅含这一项，进入步骤 4。

否则拉评估，从 `arena_evaluation.progress.detail` 里收集每个子项的 `exercise_version_sid`（键为展示名，值里才有 SID）：

```bash
bytedcli merlin arena get-evaluation --sid '<arena_evaluation_sid>'
```

**响应片段示例：**

```json
{
  "arena_evaluation": {
    "progress": {
      "detail": {
        "数学_求导": {
          "exercise_sid": "abc123",
          "exercise_version_sid": "xgtczhbiilafstchyu",
          "completed": 100,
          "score": { "avg_score": 0.87, "error_rate": 0.02 }
        }
      }
    }
  },
  "ResponseBase": { "code": 0, "message": "" }
}
```

若 `detail` 为空或没有 `exercise_version_sid`：任务可能未跑起来，先让用户确认评估状态，不要盲建导出任务。

---

## 步骤 4：按 exercise 执行（可多轮）

维护有序列表 `[exercise_version_sid…]`，**建议顺序与 `get-evaluation` 的 `detail` 遍历顺序一致**，便于对用户汇报「第 i/N 个 exercise」。

对每个 `exercise_version_sid`：

- 任一 exercise **失败不要中断整体**：记录 `error_msg` / 异常，继续下一个，最后汇总成功与失败。
- 用户需要等待时（见步骤 4e）：每完成一个 exercise 的 `DONE` 就向用户报一次进度（例如 `3/5 exercises done`），避免长时间无输出。

### 4a. 查是否已有可复用的导出任务

```bash
bytedcli merlin arena list-eval-result-export-job --arena-evaluation-sid '<arena_evaluation_sid>' --exercise-version-sid '<exercise_version_sid>'
```

**响应示例：**

```json
{
  "jobs": [
    {
      "sid": "job_abc123",
      "job_run_id": "merlin_run_001",
      "status": "DONE",
      "export_file_url": "https://tos-xxx.volces.com/bucket/export/result.json",
      "case_total": 500,
      "case_exported": 500,
      "data_type": "tos",
      "created_at": "2026-04-10T10:00:00Z",
      "error_msg": null
    },
    {
      "sid": "job_old",
      "job_run_id": "merlin_run_000",
      "status": "FAILED",
      "export_file_url": null,
      "error_msg": "export failed: ..."
    }
  ],
  "ResponseBase": { "code": 0, "message": "" }
}
```

**复用规则：**

- 用户明确要**复用已有任务**（例如「用上次导出的」「别重建」）：在 `jobs` 里找 **`status == "DONE"` 且 `export_file_url` 非空** 的记录，通常取**时间最近**的一条，直接把 URL 交给用户，**跳过 4b–4d**。
- 用户要**默认字段**且未要求改列：若已有满足条件的 DONE 任务，可直接复用 URL，跳过创建。
- 用户要求**指定列或全列**，而你看不到历史任务的列配置（CLI 列表未必带 `job_conf`）：**新建**导出任务，避免列不一致。
- `RUNNING` / `LAUNCHING` / `STARTED`：可视为进行中，若用户愿意等，对该 `sid` 走 4e 轮询，不必再 `create`。

### 4b. 获取可选列与默认列

```bash
bytedcli merlin arena get-eval-result-schema --exercise-version-sid '<exercise_version_sid>' --arena-evaluation-sid '<arena_evaluation_sid>'
```

**响应示例：**

```json
{
  "datacard_schema": [
    { "metric_name": "prompt", "value_types": ["string"], "metric_type": "reserved", "source": "datacard" },
    { "metric_name": "answer", "value_types": ["string"], "metric_type": "reserved", "source": "datacard" }
  ],
  "sample_case_schema": [
    { "metric_name": "score_0", "value_types": ["float"], "metric_type": "reserved", "source": "sample" },
    { "metric_name": "predict_0", "value_types": ["string"], "metric_type": "reserved", "source": "sample" }
  ],
  "instance_case_schema": [
    { "metric_name": "avg_score", "value_types": ["float"], "metric_type": "reserved", "source": "instance" }
  ],
  "sample_default_columns": ["score_0", "predict_0"],
  "instance_default_columns": ["avg_score"],
  "datacard_default_columns": ["prompt", "answer"],
  "max_trial_num": 1,
  "ResponseBase": { "code": 0, "message": "" }
}
```

语义对应关系（用于填 `create` 的三个数组）：

| API 字段 | create 请求字段 | 含义 |
|----------|-----------------|------|
| `datacard_schema` / `datacard_default_columns` | `datacard_selected_metrics` | 题面/标注等 DataCard 列 |
| `sample_case_schema` / `sample_default_columns` | `sample_selected_metrics` | 单次采样/模型输出列 |
| `instance_case_schema` / `instance_default_columns` | `instance_selected_metrics` | 实例级聚合列 |

### 4c. 选择列（三种需求 → 一套确定算法）

后端要求：**`datacard_selected_metrics`、`sample_selected_metrics`、`instance_selected_metrics` 每个至少 1 个字符串**，否则创建失败。

**A. 用户未提列名（默认导出）**  
三个数组分别设为：`datacard_default_columns`、`sample_default_columns`、`instance_default_columns`。  
若某一粒度的 `*_default_columns` 为空：从该粒度对应 `*_schema` 里取**第一个** `metric_name` 填入该数组。

**B. 用户要「全部字段 / 所有列」**  
对每个粒度，把该粒度 `*_schema` 中**所有** `metric_name` 去重后加入对应数组。若某粒度 `*_schema` 为空数组，该粒度仍须至少一列：用同粒度 default；default 也为空则跳过不了，应中止并说明 schema 异常。

**C. 用户只给了部分列名**  
1. 用 `get-eval-result-schema` 构建三个集合：`D`、`S`、`I` 分别为 datacard / sample / instance 中所有 `metric_name`。  
2. 对用户提到的每个名称，在 **`S` → `D` → `I`** 顺序下第一个包含该名的集合里归类（优先 sample，减少「评估输出列」误判到题面列）。  
3. 任一用户给的名称在三个集合都不出现：先向用户确认拼写；仍无则**不要瞎猜**，说明 schema 中无此列。  
4. 归类完成后，对**用户未覆盖**的粒度：用该粒度的 `*_default_columns`；若 default 为空，用该粒度 schema 的第一个 `metric_name`。  
5. 再次检查三个数组都非空。

**同名 metric 出现在多个粒度**：按上一条的 **`S` → `D` → `I` 优先级**归入一类即可。

### 4d. 创建导出任务

```bash
bytedcli merlin arena create-eval-result-export-job --arena-evaluation-sid '<arena_evaluation_sid>' --exercise-version-sid '<exercise_version_sid>' --datacard-selected-metrics '["prompt","answer"]' --sample-selected-metrics '["score_0","predict_0"]' --instance-selected-metrics '["avg_score"]' --file-format json
```

**响应示例：**

```json
{
  "job": {
    "sid": "job_new_456",
    "job_run_id": "merlin_run_789",
    "status": "LAUNCHING",
    "export_file_url": null,
    "case_total": null,
    "case_exported": null
  },
  "ResponseBase": { "code": 0, "message": "" }
}
```

- `file_format`：`"json"`（默认，TOS 链接）或 `"larksheet"`。飞书需授权，CLI 不能代用户点授权，**优先 json**。
- 记录 `job.sid` 用于轮询。

### 4e. 何时轮询、何时问用户

- **自动轮询**：用户说了要等结果、要「导出完给我链接」「全部弄好」、或主动说「轮询/等完成」→ 直接轮询，不必再问。
- **默认也轮询**：用户要的是**可下载文件**且已 `create` 成功 → 轮询到 `DONE` 或失败或超时更省事；若用户只要「发起任务」，一般会明确说「不用等」「只提交」。
- **可简短确认**：请求极度模糊且既没说要链接也没说发起时，问一句是否要等到出链接。

轮询动作：反复 `list-eval-result-export-job`，在返回的 `jobs` 里找 **sid 等于刚创建的 `job.sid`**（不要只看第一条，列表可能含历史任务）。

| status | 处理 |
|--------|------|
| `DONE` | 读 `export_file_url`；若为 null 视为异常，把 job 详情回报用户 |
| `FAILED` | 读 `error_msg`，记录并进入下一 exercise |
| `LAUNCHING` / `STARTED` / `RUNNING` | 等待约 **15s** 再查 |
| 其它未知状态 | 按 RUNNING 处理，超时后报错 |

建议总等待上限约 **30 分钟**；汇报时用 `case_exported` / `case_total`（存在则展示）。

---

## 步骤 5：交付

用表格汇总每个 exercise：`名称或 sid`、`status`、`case_exported/case_total`、`export_file_url`。失败行单独附 `error_msg`。

---

## CLI 速查

| 命令 | 作用 |
|------|------|
| `bytedcli merlin arena support-new-eval-result` | 是否可走新版导出链路 |
| `bytedcli merlin arena get-evaluation` | 评估概览 + 全部 `exercise_version_sid` |
| `bytedcli merlin arena get-eval-result-schema` | 每粒度可选列与默认列 |
| `bytedcli merlin arena list-eval-result-export-job` | 列表 / 轮询 / 找可复用 DONE |
| `bytedcli merlin arena create-eval-result-export-job` | 新建导出任务 |

调试：`--schema` 看参数，`--dry-run` 看请求体。

---

## 常见问题

| 现象 | 处理 |
|------|------|
| `supported: false` | 执行上文「不支持新版明细时的固定降级序列」 |
| 创建报「至少一个 metric」类错误 | 按 4c 补全三个数组，每类至少 1 列 |
| `export_file_url` 一直为空但 status DONE | 把完整 job JSON 给用户，可能是数据类型为 lark 或未写回 URL |
| 401/403 | `bytedcli auth login` |
| 多 exercise 部分失败 | 汇总成功链接 + 失败 sid 与原因 |

## 相关 Skills

- **arena**：分页 `list-case`、`fetch_arena_evaluation.py`、失败排查；与本 skill 互补，不是简单替换关系。
- **eval-get-result**：Exercise 汇总 metrics，不承接 Arena 整包文件导出。
