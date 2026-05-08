---
name: merlin-arena-task-slow-analysis
description: >-
  排查 Arena/Evals 评估任务卡住或运行缓慢的根因。通过 Arena 节点状态定位
  卡住环节（模型转化/推理引擎/评估），结合 exercise 级别进度与耗时分析快速定位
  慢 exercise，再用 Grafana 指标判断评估阶段瓶颈（preprocess/instance_load/inference/metric）。
  注意：本 skill 仅覆盖「慢/卡住」维度，不覆盖「任务失败」（走 arena-task-failure-analysis）。
  当用户提到以下关键词时使用：任务慢、任务卡住、评估慢、Arena 慢、运行慢、
  进度不动、完成度卡住、推理慢、preprocess 慢、metric 慢、排查慢任务、
  inference 慢、吞吐低、QPM 低、P99 高、队列堆积、instance_load 慢、
  分析慢的原因、为什么这么慢、预计多久完成、ETA。
---

# 排查评估任务卡住 / 运行缓慢

## 定位

本 skill 是任务健康检查中 **「慢 / 卡住」维度** 的排查方案。

| 症状 | 覆盖方 |
|------|--------|
| **任务慢 / 卡住 / 进度不动** | **本 skill** |
| 任务失败 / 退出码异常 | `arena-task-failure-analysis` |
| Grafana 指标采集与可视化 | `grafana-observation` |

本 skill 会 **调度** `grafana-observation` 获取指标，而非重复实现。

## 前置条件

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

所需工具：
- `bytedcli merlin arena get-evaluation` — 获取 Arena 评估信息（含 exercise 级别进度）
- `bytedcli merlin arena get-evaluation-status-graph` — 获取各节点（Preshard/Serving/Evaluation）的独立 job_run_id 和状态（底层 `get-arena-evaluation-status-graph` API；MCP 工具名 `get_arena_evaluation_status_graph`）
- `bytedcli merlin job get-run` — 获取任务状态与诊断信息
- `bytedcli merlin job get-timeline` — 获取任务时间线事件（需同时传 `job_run_id` 和 `trial_id`）
- `bytedcli merlin job list-trial-exit-info` — 获取退出码
- `bytedcli merlin job list-trial-logs` — 获取各 Pod 的日志代理 URL（`get-log` 命令不存在）
- `bytedcli merlin job get-tls-log` — 查询 TLS StreamLog（备选，部分场景可能返回空）
- `bytedcli merlin job get-grafana` — 获取 Grafana 看板 URL
- `grafana-observation` skill — Grafana 指标查询（如不可用，使用降级方案，见 Step 4 注意事项）

如果出现认证错误（401/403），运行：`bytedcli auth login`

## 输入

- Arena URL（如 `https://seed.bytedance.net/evaluation/arena/xxx?evaluation_task_sid=yyy`）
- 或 `evaluation_task_sid`
- 或 `job_run_id`（直接跳到第二层）

## 输出

结构化诊断结论：

```markdown
## 诊断结论

- **卡住环节**：<Arena 节点名 / 评估阶段名>
- **根因假设**：<一句话描述>
- **关键证据**：
  - 进度轮询：<哪些 exercise 停滞，Δ 值>
  - Grafana 面板（如可用）：<面板名 + 数值>
  - 日志：<关键日志片段>

### Exercise 进度明细
| Exercise | 进度 | 60s Δ | 状态 | 类型 |
|----------|------|-------|------|------|
| <name> | <completed>/<total> (<pct>%) | <delta> | 正常/卡住/尾部卡住 | 视频/文本/streaming |

### 预计完成时间
- 当前速率：<X> instances/min
- 剩余量：<Y> instances
- 预计：<Z> 小时（注：卡住 exercise 可能导致实际更久）

- **建议操作**：<具体修复/等待/升级 oncall>
```

## 第一层：Arena 节点定位

> **性能提示**：Step 1（get-evaluation）和 Step 2（status-graph API）的调用互相独立，可以**并行执行**以节省时间。

### Step 1：获取 Arena 评估信息

> **重要**：API 返回体非常大（数千行 JSON），必须用 `jq` 过滤后再读取，避免浪费 context。

```bash
bytedcli --site cn --vregion seed merlin arena get-evaluation --sid <evaluation_task_sid> \
  | jq '{
    status: .arena_evaluation.status,
    trial_id: .arena_evaluation.arnold_trial_brief[0].trial_id,
    job_run_id: .arena_evaluation.job_run_id,
    inference_engine: .arena_evaluation.conf.inference_engine,
    node_marks: [.arena_evaluation.conf.inference_engine_job_def_version[]?.mark],
    server_roles: .arena_evaluation.conf.resource.server_roles,
    enable_inference_server: .arena_evaluation.extra.enable_inference_server,
    grafana_url: .arena_evaluation.extra.arena_task_grafana_url,
    exercise_progress: .arena_evaluation.exercise_progress,
    progress: .arena_evaluation.progress
  }'
```

返回字段说明：

| 字段 | 用途 |
|------|------|
| `status` | 任务整体状态 |
| `trial_id` | Arnold trial ID（用于 Grafana 查询） |
| `job_run_id` | 评估节点的 job_run_id |
| `inference_engine` | 推理引擎类型（判断 Serving 节点是否存在） |
| `node_marks` | 节点类型标记数组（PRESHARD / SERVING） |
| `server_roles` | GPU 类型、数量 |
| `enable_inference_server` | 是否启用推理引擎节点 |
| `grafana_url` | Evals 看板完整 URL（Step 3 使用） |
| `exercise_progress` | exercise 级别汇总（completed/running/not_started/total） |
| `progress.completed` | instance 级别已完成数 |
| `progress.need_run_total` | instance 级别总需运行数 |
| `progress.detail` | **exercise 级别进度明细**（Step 1.5 使用） |

### Step 1.5：分析 Exercise 级别进度

从返回结果的 `progress.detail` 字段中， `completed/total` 将所有 exercise 分为三组：

| 分组 | 判断条件 | 关注点 |
|------|---------|--------|
| **已完成** | `completed = total` | 这些 exercise 不再是瓶颈 |
| **进行中** | `completed < total` 且 `completed > 0` | 当前正在消耗推理资源的 exercise，关注完成百分比 |
| **未开始** | `completed = 0` | 评估尚未启动的 exercise，关注数据量（total）和类型 |

此步骤能快速建立全局视图：
- 如果「未开始」中有大量重量级 exercise（视频/长文本），预期总耗时会更长
- 如果「进行中」的 exercise 完成比例很低且 total 很大，说明当前 exercise 就是慢的根因

**Exercise 类型识别**：从 exercise 名称推断工作负载类型，辅助判断「预期慢」vs「异常慢」：

| 名称关键词 | 类型 | 预期影响 |
|-----------|------|---------|
| `fps`、`video`、`Video`、`streaming`、`camera`、`Camera` | 视频推理 | 单 instance 推理慢，预期 P99 高 |
| `hour`、`Hour`、`longvideo`、`timelens` | 长视频 | 帧数极多，推理和预处理均慢 |
| `10fps`、`5fps` | 高帧率视频 | 帧数成倍增加，比 1-2fps 慢数倍 |
| `multiturn`、`trajectory`、`agent` | 多轮推理 | N 轮串行推理，总耗时 = N × 单轮 |
| `crawl` | 爬虫 API | 强制限速 sleep 60s/sample，QPM 极低是预期行为 |
| 无以上关键词 | 文本/图片 | 通常较快 |

### Step 1.55：Per-Exercise 耗时分析（快速定位慢 Exercise）

`progress.detail` 中已完成的 exercise 会携带 `score` 字段，包含关键的性能指标，无需额外 Grafana 查询即可快速定位瓶颈：

| score 字段 | 含义 | 异常判断 |
|-----------|------|---------|
| `avg_cost_time` | 每条 case 的平均推理耗时（秒） | >60s 偏高，>300s 严重 |
| `avg_token_per_second` | 推理 token 生成速度 | <1 tok/s 偏慢 |
| `avg_prompt_tokens` | 平均输入 token 数 | >5000 说明输入数据量大 |
| `avg_reasoning_tokens` | 平均 reasoning token 数（CoT） | >100 说明 CoT 产出多 |
| `start_time` / `end_time` | exercise 实际运行时间段 | 可算出 exercise 级别耗时 |

**分析步骤**：
1. 提取所有 `completed = total` 的 exercise 的 `score` 字段
2. 按 `avg_cost_time` 降序排列，找出最慢的 exercise
3. 结合 exercise 类型（Step 1.5）判断是「预期慢」还是「异常慢」：
   - 视频/长视频 + `avg_prompt_tokens > 5000` + `avg_cost_time > 200s` → 预期慢（输入数据量大）
   - 文本/图片 + `avg_cost_time > 100s` → 异常慢（需检查推理引擎）
   - `avg_reasoning_tokens > 0` → CoT 模式，会增加 30-50% 推理时间

**输出示例**：
```
Exercise 耗时排名（按 avg_cost_time 降序）：
  CameraBench_Vqa: avg=322.4s, tok/s=2.74, prompt_tokens=7985 [视频, CoT]
  streaming_qa_sports3kqa: avg=N/A (未完成), 轮数=3 [streaming 多轮]
  vlm_bmk_counting: avg=N/A (未完成) [视频]
  
结论：已完成 exercise 的 avg_cost_time 均 >300s，VLM 视频 + CoT 推理属预期慢。
```

### Step 1.6：进度轮询检测卡住 Exercise（关键步骤）

> **这是区分「慢」和「卡住」的最直接手段**，不依赖 Grafana，排查效率极高。

**推荐使用脚本**（自动完成快照、对比、类型识别和 ETA 估算）：

```bash
python3 scripts/poll_exercise_progress.py --eval-sid <evaluation_task_sid>
# 或从 URL 解析
python3 scripts/poll_exercise_progress.py --arena-url "https://seed.bytedance.net/evaluation/arena/xxx?evaluation_task_sid=yyy"
# 自定义间隔和快照次数（多次确认非短暂波动）
python3 scripts/poll_exercise_progress.py --eval-sid <sid> --interval 60 --snapshots 3
# JSON 输出（供程序化消费）
python3 scripts/poll_exercise_progress.py --eval-sid <sid> --json-output
```

> 脚本位置：`skills/bytedance-merlin/references/merlin-arena-task-slow-analysis/scripts/`。

**手动执行**（脚本不可用时的 fallback）：

```bash
# 定义 jq filter（只提取进度字段，避免全量数据进入 context）
JQ_PROGRESS='{exercise_progress: .arena_evaluation.exercise_progress, progress: .arena_evaluation.progress}'

# 第一次快照
bytedcli --site cn --vregion seed merlin arena get-evaluation --sid <evaluation_task_sid> | jq "$JQ_PROGRESS"

sleep 60

# 第二次快照，对比 Δcompleted
bytedcli --site cn --vregion seed merlin arena get-evaluation --sid <evaluation_task_sid> | jq "$JQ_PROGRESS"
```

**判断逻辑**：

| Δcompleted（60s 内） | 判断 | 下一步 |
|---------------------|------|--------|
| >0 | 正常推进 | 计算速率和 ETA |
| =0 且 completed 接近 total（>90%） | **尾部 instance 卡住** | 检查该 exercise 是否为 streaming/多轮类型 |
| =0 且 completed 远低于 total | **整体卡住** | 检查推理引擎状态或 preprocess 阶段 |

如果多个 exercise 同时 Δ=0，建议做**第三次快照**（再等 60s）确认非短暂波动。

**卡住 exercise 的影响**：
- 卡住的 exercise 持续占据 running 槽位，**阻塞 not_started exercise 的调度**
- 其余活跃 exercise 的推理吞吐可能因此降低（共享推理引擎资源被分散）
- 整体 ETA 应按**最慢的卡住 exercise** 估算，而非平均速率

**输出示例**：
```
Exercise 进度轮询（间隔 60s）：
  ✓ gvc_bench: 610→622 (Δ=12/min) — 正常
  ✓ temporal_grounding: 779→798 (Δ=19/min) — 正常
  ✗ streamingbench_context: 33→33 (Δ=0) — 卡住！[streaming 类型]
  ✗ sports3kqa: 318→318 (Δ=0) — 卡住！[streaming 类型]
  ✗ VideoReasonBench: 972→972 (Δ=0) — 尾部卡住 [28 instances 剩余]
  ✗ vispeak: 195→195 (Δ=0) — 尾部卡住 [5 instances 剩余]

结论：4/7 running exercise 卡住，阻塞 26 个 not_started exercise
```

### Step 2：定位问题节点

通过状态图 API 获取所有节点状态（详见 [references/arena-node-triage.md](references/arena-node-triage.md)）：

```bash
bytedcli --site cn --vregion seed merlin arena get-evaluation-status-graph --arena-evaluation-sid <evaluation_task_sid>
```

对每个非 `DONE` / 非 `is_skip` 的节点，先执行 **通用 Merlin Job 诊断**（Job 状态、Timeline、退出码、日志），再进入节点特定分支：

```
Arena 任务慢/卡住
│
├── 对问题节点执行通用 Job 诊断（状态/Timeline/退出码/日志）
│   ├── FAILED + 非 0 退出码 → 转 arena-task-failure-analysis 技能
│   └── 非 FAILED → 继续下方分支
│
├── 模型转化节点（不一定存在）
│   ├── DONE / is_skip → 跳过
│   ├── PENDING → 等待资源或换资源组
│   └── RUNNING 但无进展 → 分析日志
├── 推理引擎节点（不一定存在）
│   ├── PENDING → 等待 GPU 资源或换资源组
│   ├── RUNNING 但未就绪 → 分析推理引擎日志
│   └── RUNNING 且正常 → 问题不在此节点
└── 评估节点（一定存在）
    ├── PENDING → 等待 CPU 资源
    └── RUNNING → 进入第二层排查（Grafana 阶段瓶颈定位）
```

> 通用诊断的具体命令和节点特定的排查步骤见 **[references/arena-node-triage.md](references/arena-node-triage.md)**

## 第二层：评估阶段瓶颈定位

### 快捷路径：一键 Grafana 健康检查

如果 `grafana-observation` skill 的 `arena_health_check.py` 脚本可用，可跳过 Step 3-5 手动面板查询，直接执行：

```bash
python3 <grafana-observation-scripts>/arena_health_check.py \
  --arena-url "https://seed.bytedance.net/evaluation/arena/xxx?evaluation_task_sid=yyy"
```

> 脚本路径：`skills/bytedance-merlin/references/merlin-grafana-observation/scripts/arena_health_check.py`

脚本会自动完成：Evals 业务指标（完成度、P99、QPM、mem_rss、推理轮数）+ Arnold 容器资源指标（CPU/内存/GPU）的采集与异常检测，输出 Markdown 报告。

**注意**：
- 脚本可能耗时 2-3 分钟（需逐面板查询 Grafana API）
- 如果 Arnold 容器指标返回 0 条时间序列（常见于 cluster/dc 不匹配），脚本会跳过但不会失败
- 脚本输出的异常摘要可直接用于诊断结论，但需结合 Step 1.5/1.55 的 exercise 级别分析来区分「预期慢」和「异常慢」
- 如果脚本不可用或执行失败，回退到下方 Step 3-5 的手动流程

### Step 3：获取 Grafana URL

**优先**：使用 Step 1 中 `extra.arena_task_grafana_url` 返回的 Evals 看板 URL（已包含 `var-arena_instance_id` 和 `var-arnold_trial_id`），直接作为后续 Panel 查询的基础 URL。

**仅当需要 Arnold 资源看板（GPU/CPU/内存）时**，再调用以下命令获取含 `cluster` 和 `dc` 的 Arnold 看板 URL：

```bash
bytedcli --site cn --vregion seed merlin job get-grafana --trial-id <arnold_trial_id>
```

从返回 URL 提取 `var-cluster` 和 `var-dc`。

### Step 4：查看三个阶段完成度

> **Grafana 降级方案**：如果 `grafana-observation` skill 不可用或 Grafana API 认证失败，可以跳过 Step 4-5 的 Grafana 面板查询，改为：
> 1. 依赖 Step 1.6 的进度轮询结果判断瓶颈（哪些 exercise 卡住、速率如何）
> 2. 将 Grafana URL 直接输出给用户，让用户在浏览器中查看面板数据
> 3. 通过日志（Step 2 通用诊断的第 4 步）中的 ERROR/异常来推断根因
>
> Grafana URL 来源：Step 1 中 `extra.arena_task_grafana_url`（Evals 看板）和状态图 API 中各节点的 `grafana_url`（Serving 看板）。

使用 `grafana-observation` skill 查询 Evals 看板（UID: `ejyXFpTHk`）的以下面板：

> **重要**：Evals 看板的 `var-arena_instance_id` 变量必须使用 **`evaluation_task_sid`**（不是 `arena_sid`），否则查不到数据。

| Panel ID | 指标 | 含义 |
|----------|------|------|
| 216 | Preprocess 完成度 | `seed.evals.v1.progress.instance.store` stage=PROMPT_ASSEMBLE_DONE |
| 217 | Inference 完成度 | 同上，stage=INFERENCE_SCHEDULE_DONE |
| 219 | Metric 完成度 | 同上，stage=EVALUATE_DONE |

**判断逻辑**：对比三个阶段的完成数随时间的变化：
- Preprocess 完成度 >> Inference 完成度，且 Inference 长时间不增长 → **Inference 阶段瓶颈**（明显堆积）
- Inference 完成度 >> Metric 完成度，且 Metric 长时间不增长 → **Metric 阶段瓶颈**
- 三者数值接近，Preprocess 略领先（差值 <10%） → **Inference 阶段瓶颈**（Inference 消化速度决定整体速率，Preprocess 产出后被 Inference 立即消化，无法拉开差距）
- 三者数值接近，Preprocess 无领先 → **Preprocess 阶段瓶颈**（Preprocess 产出不足，下游 Inference 和 Metric 都处于饥饿状态）
- 三个阶段都不增长 → 检查是否整体卡住（资源/启动问题）

辅助面板：
- Panel 136：各阶段 P99 耗时 → 哪个阶段最慢（重点关注 `instance_load` 阶段，VLM 视频任务中 instance_load 可达数百甚至上千秒）
- Panel 137：各阶段 QPM → 吞吐是否正常

> **忽略 `batch_size` 指标**：Evals 看板中的 `batch_size` 相关面板（如 Panel 120）和 metric（`seed.evals.v1.batching.batch_size.store`、`seed.evals.v1.server.*.batch_size.store`）在 Arena 评估任务中恒为 1，**不具备诊断价值，不要查询也不要纳入分析**。

**Panel 136 特别关注 `instance_load` 阶段**：
- `instance_load` 是数据加载和预处理阶段（下载视频、抽帧、编码等）
- 对于 VLM 视频类任务，instance_load P99 >100s 属偏高，>500s 属严重（可能单条 case 的视频下载/解码耗时 10+ 分钟）
- instance_load 慢会导致下游 inference 阶段「饥饿」，即使推理引擎空闲也无请求可处理

### Step 4.5：进度趋势分析与预计完成时间

对 Step 4 中识别的瓶颈阶段，从其完成度时间序列中采样多个时间点，计算：

1. **当前速率**：`(recent_value - earlier_value) / time_diff`，单位 instances/min
2. **剩余量**：`total - current_finished`
3. **预计剩余时间**：`剩余量 / 当前速率`

示例输出：
```
Inference 进度趋势：
  19:45 → 2981, 20:10 → 6154 (~127/min)
  20:34 → 8282, 20:58 → 9793 (~63/min)
  21:23 → 12981, 21:47 → 14252 (~53/min)

剩余 ~15074 条，当前速率 ~80/min → 预计还需 ~3 小时
```

> 如果速率在下降，提醒用户后续可能更慢（剩余的 exercise 可能数据更重）。

### Step 5：分阶段深入诊断

根据 Step 4 识别的瓶颈阶段，进入对应的诊断分支。

> 每个阶段的详细诊断步骤（含 Grafana 面板 ID、代码级根因模式）见 **[references/eval-stage-diagnosis.md](references/eval-stage-diagnosis.md)**

#### Preprocess 瓶颈

1. 检查 Panel 216 — PREPROCESS_DONE 是否增长
2. 检查 Panel 146 — `mem_rss` 是否异常（>30GB）
   > **mem_rss 单位注意**：Grafana 返回的原始值单位是 **字节（Bytes）**，不是 GB。例如 `8898604032` ≈ 8.3GB，`348536832` ≈ 332MB。判断阈值：单进程 >30GB（即 >32,000,000,000）为异常偏高。如果数值为几十万到几百万级别是 KB 量级（正常），达到数十亿（1e9+）需要换算为 GB 再判断。
3. 结合 exercise 类型（VLM 视频帧率、长文本等）判断是预期慢还是异常

#### Inference 瓶颈

1. 检查 Panel 184 — chat_completion QPM 是否接近 0
2. 检查 Panel 183 — chat_completion P99（>60s 偏高，>300s 严重）
3. **Per-Exercise P99 分析**（关键步骤）：Panel 183 返回的数据按 `exercise_version_alias` 分组，需逐 exercise 对比：
   - 列出所有 exercise 的 P99 avg 和 max，按 avg 降序排列
   - 如果少数 exercise 的 P99 远高于其他（如 >10 倍差距），说明特定 exercise 拖慢整体
   - 结合 Step 1.5 的 exercise 列表，判断高 P99 的 exercise 是否是数据量大的重量级评测集
4. **区分「预期慢」vs「异常慢」**：

   | 信号 | 判断 | 操作 |
   |------|------|------|
   | VLM 视频评测 + 高帧率/长视频 + P99 高但 QPM 持续非 0 | **预期慢** — 工作负载固有特性 | 告知用户属于正常，给出预计完成时间 |
   | P99 高 + QPM 接近 0 或骤降 | **异常慢** — 推理服务可能故障 | 检查推理引擎日志/状态 |
   | P99 高 + QPM 极低（<1） | **可优化** — 推理吞吐严重不足 | 检查推理引擎并发配置或 exercise 是否有限速 |
   | 所有 exercise 的 P99 均匀偏高 | **异常慢** — 推理引擎整体性能问题 | 检查 GPU 利用率、模型加载状态 |
   | 仅个别 exercise P99 极高，其他正常 | **预期慢** — 特定评测集数据量大 | 正常，建议拆分重/轻评测集分开跑 |

5. **检查推理节点 GPU 利用率**（存在 Serving 节点时）：
   - 从状态图 API 获取 Serving 节点的 `merlin_job_sid` → `job get-grafana` 获取 Arnold 资源看板（`trial_id` 获取方式见 [arena-node-triage.md](references/arena-node-triage.md) 的 Serving 节点注意事项）
   - GPU 利用率 >80% + P99 高 → 计算密集型推理，属于预期慢
   - GPU 利用率 <30% + P99 高 → GPU 未被充分喂饱（instance_load 瓶颈 / CPU 预处理慢 / 请求发送不足）
   - GPU 利用率波动大 → 推理引擎可能有间歇性故障，检查 Serving 节点 Timeline 和日志
6. 查看 Grafana 队列面板 — `seed.evals.v1.queue.store` 中推理请求的 active 数量
   - **并发数非 0**：推理引擎侧有异常
     - 存在推理引擎节点 → 检查 GPU 利用率 + 分析推理引擎日志
     - 不存在推理引擎节点 → 用户需排查其提供的推理服务
   - **并发数为 0**：评估节点 head 侧有问题
     - 存在 agent 节点 → 排查 agent 节点异常
     - 检查 head 节点日志，排查调度或连接问题
7. **Streaming/多轮推理专项检查**：Panel 191（最大推理轮数）判断多轮 exercise 的轮数是否合理；Panel 186（未完成 instance 数量 >500 = 大量堆积）
   - Agent 类任务：推理轮数 >50 = 可能死循环
   - Streaming 类任务：推理轮数 3-10 属正常，但单轮 P99 高时总耗时 = P99 × 轮数，需重点关注

#### Metric 瓶颈

1. 检查 Panel 164 — instance metric P99 耗时
2. 检查 Panel 170 — openai 模型推理耗时（裁判员模型延迟）
3. 结合 status_code 分析是否有 LLM judge API 错误（429 限流、5xx 服务异常）

### Step 6：跨阶段通用检查

无论瓶颈在哪个阶段，额外检查：
- **背压**：Pressure/Scheduler 面板 — `queue.produce.limit.counter` / `consume.limit.counter`
- **资源**：Arnold Role 看板 — CPU 利用率、内存、GPU DutyCycle
- **内存泄漏**：Panel 146 `mem_rss` 持续增长

> **Arnold 资源看板无数据的降级方案**（Role 看板 head/worker 返回 0 条时间序列时）：
> 1. 确认 `cluster` 和 `dc` 参数正确（Role 看板 `JiidrBwGzrole` 必须精确匹配，否则返回空数据）
> 2. 尝试切换到 Container 看板（`LgKuxDjSz`），用 `_pod_name` 过滤，`cluster=All`（注意：无 GPU 指标）
> 3. 从 Serving 节点的 xgptserver-metrics 看板（状态图 API 返回的 `grafana_url`）直接查看推理引擎侧指标
> 4. 如果以上都无数据，改用 QPM + P99 间接推断：QPM 持续非 0 且 P99 稳定 → 推理引擎正常工作；QPM 骤降至 0 + P99 飙升 → 推理引擎异常

## 关联技能

| 技能 | 用途 |
|------|------|
| `grafana-observation` | Grafana 指标采集与可视化（如不可用，使用 Step 4 降级方案） |
| `arena-task-failure-analysis` | 任务失败排查（退出码、日志、诊断性 fork） |

## 渐进披露

- **Arena 节点状态判断方法** → **[references/arena-node-triage.md](references/arena-node-triage.md)**
- **分阶段详细诊断（Grafana + 代码级根因模式）** → **[references/eval-stage-diagnosis.md](references/eval-stage-diagnosis.md)**
