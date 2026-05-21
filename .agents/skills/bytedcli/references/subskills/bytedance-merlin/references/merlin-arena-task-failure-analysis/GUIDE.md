---
name: merlin-arena-task-failure-analysis
description: 自动分析 Arena 评估任务的失败原因，多节点诊断（推理服务节点、评估节点、preshard 节点等），结合 evals 代码与日志定位根因并给出修复建议。当用户说"Arena 评估任务失败了/帮我分析评估失败原因/评估任务报错了/为什么评估任务跑失败/Arena 任务挂了/评估节点失败/评估 OOM/Arena task failed/分析这个评估链接/诊断评估任务"时使用。即使用户只贴了 Arena 或 Seed 评估链接、或任务状态为 FAILED，也应主动用本 skill 做失败分析（不要等用户说「用 skill」）。
compatibility: 需要已安装并可登录的 bytedcli；Arena URL 含 seed.bytedance.net 时使用 `--site cn --vregion seed`。
---

# Arena 评估任务失败分析

自动分析 Arena 评估任务的多节点失败原因，输出结构化诊断报告。

## 分层阅读（渐进式）

| 层级 | 内容 |
|------|------|
| 本文 `GUIDE.md` | 前置条件、辅助脚本、完整诊断流程（六步）、报告结构、关联技能 |
| `references/failure-scenarios.md` | **常见失败场景速查**（按表现反查根因与修复；篇幅较长时只读该文件对应小节） |

Arena 评估任务包含**推理服务节点**和**评估节点**，都是独立的 Merlin Job，各自有独立的 Job Run ID、Trial ID、日志、Timeline 和 Grafana 监控。

#### 推理引擎类型（`conf.inference_engine`）

Arena 支持多种推理引擎，每种引擎的节点组成不同：

| `inference_engine` | 节点组成 | 有 Preshard？ | 说明 |
|-------------------|---------|:---:|------|
| `xgpt_infir` | XGPT Preshard + XGPT Serving | ✅ | 标准 XGPT 推理引擎 |
| `xgpt_triton` | XGPT-Triton Preshard + XGPT-Triton Server | ✅ | XGPT + Triton 后端 |
| `crawl_server` | Crawl Server | ❌ | 爬取/调用外部 API 的服务 |
| `vlm_mariana_server` | VLM Mariana Server | ❌ | VLM 多模态推理（Mariana 框架） |
| `unified_server` | Unified Server | ❌ | 统一推理服务封装 |
| `speech_server` | Speech Server | ❌ | 语音模型推理 |
| 空 / 无 | 无推理服务节点 | ❌ | 仅评估节点（如离线评估） |

所有推理服务节点在 Status Graph 中的 `mark` 都是 `SERVING_MERLIN_JOB`，Preshard 节点的 `mark` 是 `PRESHARD_MERLIN_JOB`，通过 `node_name` 区分具体类型。

每种推理引擎节点的**诊断方法完全相同**——都是独立的 Merlin Job，都使用同一套命令（`job get-run`、`list-trial-exit-info`、`list-trial-logs`、`get-timeline`）。区别在于：
- **有 Preshard 的引擎**（xgpt_infir、xgpt_triton）：Preshard 失败时 `inference_reason` 含 `[<Preshard节点名>] Failed`
- **无 Preshard 的引擎**（crawl_server、mariana、unified、speech）：直接跳过 Preshard，服务启动失败时 `inference_reason` 含 `[<Server节点名>] Stopped/Failed`
- **GPU 类引擎**（xgpt_infir、xgpt_triton、vlm_mariana_server）：可能出现 CUDA 显存 OOM
- **非 GPU 引擎**（crawl_server、speech_server）：不会有 CUDA OOM，但可能有系统内存 OOM

**关键认知**：诊断时不能只看评估节点——**必须查看出问题的那个节点自身的 Job 状态和日志**。

## 前置条件

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

URL 中包含 `seed.bytedance.net` 时，必须使用 `--site cn --vregion seed`。如遇 401/403，运行 `bytedcli auth login`。

## 辅助脚本

> **⚠️ 脚本输出 ≠ 最终诊断。** 脚本只做初步信息采集（评估节点的 ray_log），**不查推理服务节点的日志和退出码**——而推理服务节点恰恰是最常见的失败来源。你必须按下方完整诊断流程继续执行，直到拿到失败节点的**具体退出码和日志错误内容**为止。

从 **本 skill 根目录**（与 `GUIDE.md` 同级）执行：

```bash
python3 scripts/diagnose_arena_task.py \
  --url "<arena_url_or_evaluation_task_sid>" \
  --site cn --vregion seed \
  --out-dir ./arena_diagnosis
```

若在 bytedcli 仓库根目录下执行，路径为 `skills/bytedance-merlin/references/merlin-arena-task-failure-analysis/scripts/diagnose_arena_task.py`。

脚本输出可作为第一步和第二步的快速参考，但**从第二步的 Status Graph API 开始，后续所有诊断步骤必须手动执行**——不要将脚本报告作为最终结论。

## 诊断流程

核心原则：**先确定是哪个节点挂了，再针对性地去查对应节点的日志和监控。**

### 第一步：解析输入，获取评估任务概览

从 Arena URL 中提取 `evaluation_task_sid`（URL query 参数），或直接使用用户给出的 SID。

```bash
bytedcli --site cn --vregion seed merlin arena get-evaluation --sid <evaluation_task_sid>
```

从返回的 `arena_evaluation` 中提取关键信息：

| 字段 | 用途 |
|------|------|
| `status` | 任务整体状态（FAILED / COMPLETED / RUNNING） |
| `job_run_id` | 对应的 Merlin Job ID（评估节点） |
| `arnold_trial_brief` | Trial ID 列表 |
| `extra.enable_inference_server_create_status` | 推理服务节点创建状态 |
| `extra.enable_inference_server_create_failed_reason` | 推理服务节点失败原因 |
| `conf.inference_engine_job_def_version` | 推理引擎节点列表（preshard、serving 等） |
| `exercise_progress` | 各 exercise 的完成/失败统计 |
| `progress.detail` | 每个 exercise 的完成数、总数、状态 |
| `progress.progress_error_rate_count_info` | 错误率统计 |

### 第二步：确定失败节点 + 获取各节点 Job ID

这是最关键的一步。根据第一步拿到的信息，判断失败出在哪个节点，再决定后续查什么。

> **强制规则（适用于所有场景，不可跳过任何一条）**：
> 1. **必须执行 Status Graph API**（见下方 2.1 节）获取所有节点各自的 `job_run_id`，不能只用第一步 `arena get-evaluation` 的数据——那个 `job_run_id` 只是评估节点的
> 2. **日志优先**：对失败节点，**先拿日志、先读 worker stdout**，在日志中搜索错误关键词定位根因
> 3. **退出码辅助**：对失败节点执行 `list-trial-exit-info`，检查**所有 Pod**（head + 每个 worker）的退出码，对照下方速查表辅助分类
> 4. 退出码只能告诉你"大概是什么类型的问题"，**日志才能告诉你"具体出了什么错"**
> 5. **诊断必须给出具体证据**：最终报告中必须包含退出码数值、日志中的错误行等具体信息。「Preshard 失败了」「推理服务创建失败」这种只是复述 API 状态字段，不是诊断结论

#### 全节点退出码速查表（Preshard / Serving / Evaluation 通用）

| 退出码 | 含义 | 根因类别 | 下一步 |
|--------|------|---------|--------|
| **-79999** | **可抢占/弹性 Quota 资源被回收** | 资源抢占 | 确认是否使用了可抢占队列；建议换非抢占队列或增加重试 |
| **-77777** | **资源利用率不达标被查杀** | 低利用率 | **必须进一步查明利用率低的原因。** ①对比 Serving 和 Evals 两侧的时间戳（`schedule_time` / `stop_time`）；②若 Evals 在 Server 被杀**之后**才启动 → Evals 排队太久是根因（场景 7）；③若 Evals 已经在运行但 Server 仍被杀 → 可能是 Server 配置/网络/PSM 问题导致无流量；④在报告中写明时间线和具体原因 |
| **30002** | **机器故障** | 基础设施 | 建议在高级配置中屏蔽该 IP 后重试 |
| **10005** | **Arnold 判定 OOM** | 内存不足 | 场景 3：查 Grafana `unreclaimable_ratio` 交叉验证 |
| **137** | **SIGKILL（可能是 OOM Killed）** | 疑似内存不足 | 需 Grafana 交叉验证，不能仅凭此码判定 OOM |
| **60007** | **实例被删除** | 被抢占/终止 | 场景 5 |
| **2** | **应用层错误（通用）** | 代码/环境 | 查 stdout/stderr 日志定位具体错误 |
| **1** | **应用层错误** | 代码异常 | 查 stderr/stdout |
| **255** | **用户脚本异常退出** | evals 代码/依赖 | 查 ray_log 定位 traceback |
| **0** | **正常退出** | 非失败 | — |
| **空 / 无退出信息** | **任务被清洁停止（STOPPED）** | 用户/平台操作 | 检查是否有 CUDA OOM 等隐藏问题 |

**判断逻辑（按优先级从上到下检查，命中第一个即执行）：**

| # | 条件（仅基于第一步数据，不需要看日志） | 失败节点 | 下一步 |
|---|------|---------|--------|
| 1 | `inference_reason` 含 `Preshard` + `Failed` | **Preshard 节点**（XGPT/XGPT-Triton） | → 第三步A「Preshard 节点失败诊断」 |
| 2 | `inference_reason` 含 `[<任意Server名>] Stopped/Failed` 且 0 exercise 完成 | **推理服务失败/被停止** | → 第三步A「推理服务节点失败诊断」。如果 Serving 退出码是 **-77777**，还需执行第三步C（查 Evals 节点时间线），对比两侧时间后判断根因——见「-77777 专项诊断」子节 |
| 3 | `inference_status` = FAILED + **部分 exercise 有进展**（completed > 0） | **推理服务中途挂了** | → 第三步A「推理服务节点失败诊断」+ CUDA OOM 检查（仅 GPU 类引擎） |
| 4 | 任务 **STOPPED** + 部分 exercise 完成 | **可能是 Serving OOM 或用户手动停止** | → 第三步A「推理服务节点失败诊断」+ CUDA OOM 检查（仅 GPU 类引擎） |
| 5 | `inference_status` = FAILED + 0 exercise + `inference_reason` 含 `mlx stop` | **评估节点先挂**，推理服务被平台回收 | → 第三步C：分析评估节点 |
| 6 | `inference_status` = FAILED + 0 exercise + `inference_reason` **不含** `mlx stop` | **推理服务节点** | → 第三步A「推理服务节点失败诊断」+ 第三步B |
| 7 | 评估 `job_run_id` 非空 + 任务 FAILED | **评估节点** | → 第三步C：分析评估节点 |

> **字段映射**（第一步返回中）：
> - `inference_status` = `extra.enable_inference_server_create_status`
> - `inference_reason` = `extra.enable_inference_server_create_failed_reason`
> - exercise 进展：看 `progress.detail` 中是否有任何 exercise 的 `completed > 0`
>
> **`inference_reason` 常见格式**：`[XGPT Preshard] Failed`、`[XGPT Serving] Stopped`、`[XGPT-Triton Server] Stopped`、`[Crawl Server] Stopped`、`[VLM Mariana Server] Stopped`、`[Unified Server] Stopped`、`[Speech Server] Stopped`、`user mlx stop inference server manually`

**多节点共存问题**：多个节点可能同时有问题，需用 `job get-timeline` 对比各节点时间线判断**谁先挂**。特别关注 Eval 排队等待时间（`JobCreated` → `RobustStartRun` 间隔超过数小时 → 场景 7）。

#### 2.1 获取各节点 job_run_id（判断命中后的第一个动作，不可跳过）

> **这是整个诊断流程中最容易被跳过的一步，也是最关键的一步。** 如果你不执行这一步，你将无法获取 Preshard 或推理服务节点的日志和退出码，诊断将停留在「知道哪个节点挂了但不知道为什么」的半成品状态。
>
> `arena get-evaluation` 返回的 `job_run_id` **只是评估节点的**。Preshard 和推理服务节点有各自独立的 Merlin Job ID，必须通过 Status Graph API 获取。

```bash
bytedcli --site cn --vregion seed merlin arena get-evaluation-status-graph --arena-evaluation-sid <evaluation_task_sid>
```

**返回值解析**（顶层 key 是 `status_graph`，**没有** `data` 包裹）：

将 `bytedcli merlin arena get-evaluation-status-graph` 的标准输出解析为 JSON 后，可按下述方式读取节点列表。

```python
import json
resp = json.loads(output)  # output: 上述 bytedcli merlin 命令的标准输出字符串
nodes = resp["status_graph"]["node"]  # 不是 resp["data"]["status_graph"]["node"]
for node in nodes:
    print(node["mark"], node.get("merlin_job_sid"), node.get("status"))
```

| `mark` 字段 | 节点类型 | `node_name` 示例 | 关键字段 |
|-------------|---------|-----------------|----------|
| `PRESHARD_MERLIN_JOB` | Preshard 节点 | `XGPT Preshard`、`XGPT-Triton Preshard` | `merlin_job_sid`（即 `job_run_id`）、`status` |
| `SERVING_MERLIN_JOB` | 推理服务节点 | `XGPT Serving`、`Crawl Server` 等 | `merlin_job_sid`（即 `job_run_id`）、`status`、`grafana_url` |
| `ARENA_EVALUATION` | 评估节点 | （空或无） | `merlin_job_sid`、`status`、`grafana_url` |

当节点未创建时，`merlin_job_sid` 为 `None`（字符串）或空字符串 `""`——检查方式：`if not sid or sid == "None"`。

> 没有 Preshard 的引擎（crawl_server、vlm_mariana_server、unified_server、speech_server）的 Status Graph 中不会有 `PRESHARD_MERLIN_JOB` 节点。所有推理服务节点（无论类型）的 `mark` 都是 `SERVING_MERLIN_JOB`，用 `node_name` 区分具体类型。

拿到失败节点的 `merlin_job_sid` 后，进入第三步对应的诊断子节。

> **自检**：如果你到这里还没有执行 Status Graph API，或者拿到的 `merlin_job_sid` 为空/None 就准备输出结论——**停下来，你的诊断还没开始。** 评估节点的 `job_run_id` 为空不代表"没有 Job 可查"，Preshard 和推理服务有各自独立的 Job。

#### 常见误区（其他模型容易犯的错误）

| 误区 | 正确做法 |
|------|---------|
| ❌ 只看 head 退出码就下结论 | ✅ 必须检查**所有 Pod**（head + 每个 worker）退出码，worker 退出码往往才是真正根因 |
| ❌ 任务 STOPPED → 直接结论"用户主动停止，无异常" | ✅ STOPPED 状态**不代表无异常**，必须检查 Serving worker stdout 是否有 CUDA OOM |
| ❌ 看到 `[XGPT Preshard] Failed` 但不查 Preshard Job | ✅ 必须通过 Status Graph API 获取 Preshard 的 `merlin_job_sid`，然后查其 exit info 和日志 |
| ❌ 评估日志有 `DistStoreError`/500 → 结论"评估节点问题" | ✅ 这通常是 Serving 节点 CUDA OOM 的**下游表现**，必须去查 Serving worker stdout |
| ❌ exit code 137 → 直接判定 OOM | ✅ 137 仅表示 SIGKILL，需 Grafana `unreclaimable_ratio` 交叉验证 |
| ❌ `inference_reason` 含 `mlx stop` → 结论"平台搞坏了" | ✅ `mlx` 是平台系统用户，`mlx stop` 是**平台在评估已失败后的清理行为**，不是根因 |
| ❌ 用 `data.status_graph.node[]` 解析 API 响应 | ✅ 正确路径是 `response["status_graph"]["node"]`，没有 `data` 包裹 |
| ❌ 只从 `arena get-evaluation` 取 `job_run_id` | ✅ 这只是评估节点的 ID；Preshard 和推理服务的 ID 必须从 Status Graph API 获取 |
| ❌ 只认识 XGPT，遇到 Crawl/Mariana/Unified/Speech 就不知道怎么查 | ✅ **所有推理服务节点的诊断方法完全相同**——都是 Merlin Job，用同一套命令查 exit info、日志、timeline |
| ❌ 对 Crawl Server 检查 CUDA OOM | ✅ Crawl Server 通常不用 GPU，不会有 CUDA OOM；应查网络/API 相关错误 |
| ❌ 判断出「Preshard 失败」或「推理服务创建失败」就输出最终结论 | ✅ 判断失败节点只是**第二步**，必须继续执行 2.1（Status Graph API）+ 第三步（退出码 + 日志）拿到**具体错误**才算完成 |
| ❌ Serving 退出码 -77777 → 直接结论"低利用率被查杀"就结束 | ✅ -77777 表示 Server 因低利用率被杀，但**低利用率本身有多种原因**。必须对比 Serving 和 Evals 两侧时间线来判断：Evals 排队太久（最常见）、Server 配置/网络问题导致无流量、Evals 已启动但未向 Server 发请求等。在根因中写明具体原因和时间线证据 |

### 第三步A：分析推理服务节点失败（Preshard / Serving / Crawl / Mariana / Unified / Speech）

使用第二步 2.1 中通过 Status Graph API 获取的失败节点 `merlin_job_sid`（即 `job_run_id`），进入下方对应的诊断子节。**如果你还没有执行 Status Graph API，现在回到第二步 2.1 执行。**

#### Preshard 节点失败诊断（当 `mark=PRESHARD_MERLIN_JOB` 且 `status=FAILED` 时）

Preshard 失败意味着模型权重转换未完成，后续 Serving 和 Evaluation 都不会启动。

> **核心原则：日志优先**。退出码只能粗分类（抢占 vs OOM vs 应用错误），**真正的根因永远在 worker stdout 日志里**。必须先拿日志、读日志，退出码作为辅助参考。

诊断步骤：

```bash
# 1. 获取 Preshard Job 状态和 trial_id
bytedcli --site cn --vregion seed merlin job get-run --job-run-id <preshard_job_run_id>
# 从返回的 meta.arnold_trial_id 提取 trial_id

# 2. 获取日志（最重要——根因在 worker stdout 里）
bytedcli --site cn --vregion seed merlin job list-trial-logs --job-run-id <preshard_job_run_id> --trial-id <trial_id>

# 3. 获取所有 Pod 的退出信息（辅助：用退出码快速分类）
bytedcli --site cn --vregion seed merlin job list-trial-exit-info --job-run-id <preshard_job_run_id> --trial-id <trial_id>
```

**日志分析（第一优先级）**：拿到日志 URL 后，逐个读 **worker stdout**（不是 head stdout），搜索关键词：

```bash
# 搜索错误关键词
no_proxy=* curl -sS "<worker_stdout_url>" | grep -n -i -E "Error|Exception|Traceback|OOM|OutOfMemory|CUDA|Failed" | head -20
# 对命中行取上下文
no_proxy=* curl -sS "<worker_stdout_url>" | tail -n 500
```

常见日志中的根因：
- `torch.OutOfMemoryError` / `CUDA out of memory` → GPU 显存不足
- `FileNotFoundError` / `No such file or directory` → 权重路径不可访问
- `KeyError: 'architectures'` → config.json 缺字段
- `RuntimeError` + traceback 指向 preshard 代码 → Preshard 版本不支持该模型架构
- 日志为空或无明显错误 → 结合退出码判断（见下方）

**退出码分析（第二优先级）**：`list-trial-exit-info` 返回 head 和每个 worker 的退出信息。**必须检查所有 Pod**——head 退出码可能是泛化的 `2`，**真正根因在 worker 退出码**：

| Worker 退出码 | 原因 | 修复 |
|--------------|------|------|
| **-79999** | 可抢占资源被回收——Preshard 需要较长时间（大模型 20-60 分钟），worker 存活时间不足 | 使用非抢占队列 |
| **30002** | 机器故障——worker 从未启动，日志通常为空 | 屏蔽故障 IP 后重试 |
| **137 / 10005** | OOM——模型过大，Preshard 内存不足 | 增加内存配额 |
| **1 / 2** | 应用层错误——**日志中必有 traceback** | 从日志定位具体错误 |

如果多个 worker **反复被抢占**（出现多个 worker Pod 且都是 `-79999`），说明 Preshard 使用的资源不稳定。查看 worker 的 `schedule_time` → `stop_time` 间隔可确认每个 worker 实际存活了多久。

#### 推理服务节点失败诊断（当 `mark=SERVING_MERLIN_JOB` 且 `status=FAILED/STOPPED` 时）

适用于所有推理引擎类型：XGPT Serving、XGPT-Triton Server、Crawl Server、VLM Mariana Server、Unified Server、Speech Server。

> **核心原则：日志优先**。与 Preshard 一样，退出码只是辅助分类，**根因在 worker stdout 日志中**。

```bash
# 1. 获取推理服务 Job 状态及 trial_id
bytedcli --site cn --vregion seed merlin job get-run --job-run-id <server_job_run_id>
# 从返回的 meta.arnold_trial_id 提取 trial_id

# 2. 获取日志（最重要——根因在 worker stdout 里）
bytedcli --site cn --vregion seed merlin job list-trial-logs --job-run-id <server_job_run_id> --trial-id <trial_id>

# 3. 获取所有 Pod 的退出信息（辅助分类）
bytedcli --site cn --vregion seed merlin job list-trial-exit-info --job-run-id <server_job_run_id> --trial-id <trial_id>

# 4. 获取 Timeline（用于判断时序关系）
bytedcli --site cn --vregion seed merlin job get-timeline --job-run-id <server_job_run_id> --trial-id <trial_id>
```

**日志分析（第一优先级）**：拿到日志 URL 后，逐个读 **每个 worker 的 stdout**，搜索错误关键词：

```bash
no_proxy=* curl -sS "<worker_stdout_url>" | grep -n -i -E "Error|Exception|Traceback|OOM|OutOfMemory|CUDA|Failed|Timeout|Connection" | head -20
no_proxy=* curl -sS "<worker_stdout_url>" | tail -n 500
```

**退出码分析（第二优先级）**：结合 `list-trial-exit-info` 中所有 Pod 的退出码辅助判断（对照第二步退出码速查表）。

**Timeline 分析**：通过对比各节点的 Timeline 判断时序：
- Server 什么时候启动、什么时候被停止
- Evals 节点什么时候开始运行
- 是 Server 先挂导致 Evals 失败，还是 Evals 排队太久导致 Server 被平台回收

常见的推理服务被停止原因（**日志 + 退出码** 综合判断）：
- **CUDA 显存 OOM**：日志中有 `torch.OutOfMemoryError`（退出码可能正常/无）——**仅 GPU 类引擎**，见下方 CUDA OOM 检查
- **系统内存 OOM**：日志中有 `Memory cgroup out of memory`（退出码 137/10005）
- **模型加载失败**：日志中有 traceback 指向权重加载（退出码 1/2）
- **低利用率被 kill**：日志可能无明显错误（退出码 -77777）→ **见下方「-77777 专项诊断」，需进一步判断原因**
- **被抢占**：日志可能无明显错误（退出码 -79999）
- **外部 API 不可达**（Crawl Server 特有）：日志中有 `ConnectionError`/`TimeoutError`
- **依赖服务未就绪**（Unified Server 特有）：日志中有 `ConnectionRefused`/`ServiceUnavailable`

#### -77777 专项诊断（Serving 因低利用率被查杀时的根因判定）

`-77777` 表示 Server 因 GPU/资源利用率不达标被平台查杀。**低利用率本身有多种可能原因**，需要通过时间线对比来判定具体根因：

| 场景 | 特征 | 根因 |
|------|------|------|
| Evals 排队太久（最常见） | Evals `schedule_time` 远晚于 Serving `schedule_time`，甚至在 Serving `stop_time` 之后 | Evals 排队/调度延迟过长，Server 空转等待期间无请求被查杀 |
| Evals 已启动但未打流量 | Evals 已在运行，ray_log 有输出，但 Server 无请求记录 | 可能是 PSM 配置错误、网络不通、Evals 侧连接 Server 失败等 |
| Server 自身问题 | Server 日志有启动报错/健康检查失败/端口监听异常 | Server 未能正常 ready，虽未 crash 但无法接受请求 |
| -77777 即为最终根因 | Evals 和 Server 均正常运行了一段时间，但 Server 利用率确实不达标 | 评测集太小或请求密度太低，Server 空闲率超出平台容忍阈值 |

当 Serving 节点退出码为 **-77777** 时，执行以下步骤判定根因：

1. **获取 Evals 节点的时间信息**（二选一）：
   - 方式 A（推荐）：`list-trial-exit-info` 获取 Evals worker 的 `schedule_time`
   - 方式 B：从 Evals 的 ray_log 中取第一条日志的时间戳
   ```bash
   bytedcli --site cn --vregion seed merlin job list-trial-exit-info --job-run-id <eval_job_run_id> --trial-id <eval_trial_id>
   ```

2. **获取 Serving 节点的时间信息**：从 Serving 的 `list-trial-exit-info` 中取 `schedule_time`（启动）和 `stop_time`（被杀）

3. **计算并对比关键时间点**：
   ```
   Server 启动时间:  schedule_time（Serving worker）
   Server 被杀时间:  stop_time（Serving worker）
   Evals 启动时间:   schedule_time（Evals worker）
   
   Server 运行时长 = Server被杀 - Server启动
   Evals 延迟时长  = Evals启动 - Server启动
   ```

4. **根据时间线判定根因**：
   - **Evals 启动 > Server 被杀** → 根因是 Evals 排队太久，Server 空转期间无请求被杀。报告中写明排队时长
   - **Evals 启动 ≈ Server 启动，但 Server 仍无流量** → 查 Evals ray_log 是否有 `server not ready` / `ConnectionError`，检查 Server 日志是否有启动异常
   - **Evals 正常向 Server 发送了请求，但利用率仍不达标** → -77777 本身即为根因（Server 确实空闲率过高）

5. **（可选）查 Evals ray_log 确认证据**（如果 Evals `job_run_id` 非空）：
   ```bash
   no_proxy=* curl -sS "<ray_log_url>" | grep -n -i -E "server not ready|empty url|RuntimeError.*RayClusterProxy|ConnectionError" | head -5
   ```

> **自检**：诊断报告中是否写明了「Server 低利用率的具体原因」（而不只是写 -77777）？如果原因是 Evals 排队太久，是否写明了具体时长？

#### 各引擎差异化日志关键词

不同引擎的 worker stdout/stderr 中错误关键词不同，诊断时按引擎类型搜索对应关键词：

| 引擎 | 日志关键词（搜索 worker stdout） | 说明 |
|------|-------------------------------|------|
| XGPT Serving / XGPT-Triton | `OutOfMemoryError`, `CUDA out of memory`, `gloo Socket Timeout`, `DistStoreError` | GPU 显存 OOM、DP 通信超时 |
| VLM Mariana Server | `OutOfMemoryError`, `CUDA out of memory`, `RuntimeError`, `torch.cuda` | GPU 显存 OOM（Mariana 框架） |
| Crawl Server | `ConnectionError`, `TimeoutError`, `HTTPError`, `requests.exceptions`, `URLError` | 网络/API 调用失败 |
| Unified Server | `ServiceUnavailable`, `ConnectionRefused`, `BackendError`, `timeout` | 底层服务不可用 |
| Speech Server | `OutOfMemoryError`, `RuntimeError`, `AudioError`, `SampleRateError` | 音频处理/模型错误 |
| 所有引擎通用 | `Memory cgroup out of memory`, `Killed process`, `OOM`, `Traceback`, `Error`, `Exception` | 系统内存 OOM、通用异常 |

#### 推理服务节点 CUDA 显存 OOM 检查（GPU 类引擎不可跳过）

**适用引擎**：`xgpt_infir`、`xgpt_triton`、`vlm_mariana_server`。**不适用**：`crawl_server`、`speech_server`、`unified_server`（非 GPU 或不直接运行模型推理）。

**重要**：CUDA 显存 OOM 发生在推理服务节点 **各 worker 的 stdout 日志**中，不在 ray_log 里，也不在 stderr 里。必须逐个检查 worker stdout。

当评估节点日志中出现 `DistStoreError: Socket Timeout`、`CustomApiError (err_code=500)` 或 `dp_coord` 相关超时时，很可能是推理服务节点 CUDA OOM 的下游表现。此时必须检查推理服务节点的 worker stdout 日志以确认根因。

诊断步骤：

1. 获取 Serving 节点所有 worker 的日志 URL：
   ```bash
   bytedcli --site cn --vregion seed merlin job list-trial-logs --job-run-id <server_job_run_id> --trial-id <trial_id>
   ```

2. 在**每个 worker 的 stdout** 日志中搜索 CUDA OOM：
   ```bash
   no_proxy=* curl -sS "<worker_stdout_url>" | grep -c "OutOfMemoryError"
   ```

3. 若匹配 > 0，获取完整 OOM 错误上下文（含调用栈）：
   ```bash
   no_proxy=* curl -sS "<worker_stdout_url>" | grep -n -i "OutOfMemoryError" | head -5
   # 对每个命中行号 N，读取前后各 30 行上下文：
   no_proxy=* curl -sS "<worker_stdout_url>" | sed -n '$((N-30)),$((N+30))p'
   ```

4. 从 OOM 错误信息中提取关键字段：
   - **尝试分配的大小**（`Tried to allocate X MiB`）
   - **GPU 总容量**（`GPU N has a total capacity of Y GiB`）
   - **剩余空间**（`of which Z MiB is free`）
   - **各进程占用**（`Process P has W GiB memory in use`）
   - **OOM 发生的模型组件**（从 traceback 中确认，如 `seed_vit_model.py`、`attention` 等）
   - **DP rank**（从 Actor 名 `XGPTServerBackend#DP0` / `#DP1` 确认）

5. 因果链确认：CUDA OOM → DP 通信超时（gloo Socket Timeout）→ eval 节点 500 错误 → 评估卡顿

**注意**：CUDA 显存 OOM 任务状态可能是 STOPPED（用户看到异常后手动停止）而非 FAILED。不能仅凭 STOPPED 状态就判定为"用户主动停止无异常"——**必须检查 Serving 节点日志后才能下结论**。参见 `references/failure-scenarios.md` 场景 9。

### 第三步B：检查推理服务元信息

检查 `extra` 字段中的推理服务状态：

```python
inference_status = extra.get("enable_inference_server_create_status")
inference_failed_reason = extra.get("enable_inference_server_create_failed_reason")
```

常见失败模式：

| 状态 | 含义 | 典型原因 |
|------|------|----------|
| `CREATE_MERLIN_JOB_FAILED` | 推理服务 Job 创建失败 | GPU 资源不足、队列权限问题 |
| `SERVING_FAILED` | 推理服务启动后异常退出 | 模型加载失败、OOM、权重路径错误 |
| `[XGPT Serving] Stopped` | Serving 节点被停止 | 通常是 preshard 完成后 serving 启动失败或被抢占 |
| `[XGPT Preshard] Failed` | 预分片节点失败 | 权重格式不匹配、HDFS 路径不可访问 |

**重要：区分推理服务停止是"因"还是"果"**

当 `enable_inference_server_create_failed_reason` 包含 `user mlx stop inference server manually` 时，`mlx` 是**平台系统用户**，这代表的是**平台自动回收行为**，通常发生在评估节点已经失败之后。平台检测到评估已结束/失败，主动停止推理服务释放资源。此时推理服务停止**不是根因，而是后果**。

判断推理服务停止是因还是果的方法：
- 操作者是 `mlx` 或其他平台用户 → 大概率是平台自动回收（后果）
- 操作者是任务创建者本人 → 用户主动停止
- 所有 exercise 完成数为 0 且无日志可查 → 需要日志才能判断真正根因，推理服务停止可能只是表象
- 部分 exercise 有进展，日志中有 `get_one_request_url got empty url` → 推理服务中途失败是根因

### 第三步C：分析评估节点（Merlin Job）

使用评估任务返回的 `job_run_id` 和 `trial_id`（从 `arnold_trial_brief` 中取最新的）：

```bash
# 获取 Job 状态（包含资源配置信息）
bytedcli --site cn --vregion seed merlin job get-run --job-run-id <job_run_id>

# 获取 Pod 退出信息
bytedcli --site cn --vregion seed merlin job list-trial-exit-info --job-run-id <job_run_id> --trial-id <trial_id>

# 获取日志列表
bytedcli --site cn --vregion seed merlin job list-trial-logs --job-run-id <job_run_id> --trial-id <trial_id>
```

#### 资源配额检查（判断 OOM 的关键依据）

从 `job get-run` 返回的 `job_run.meta.job_def_version.resource.arnold_config.roles` 中提取每个角色的内存配额：

```python
roles = job_meta["job_def_version"]["resource"]["arnold_config"]["roles"]
for role in roles:
    print(f'{role["name"]}: CPU={role["cpu"]}, Memory={role["memory"]}MB, GPU={role["gpu"]}')
```

将 OOM 日志中被杀进程的 RSS 与节点内存配额对比：
- 如果单个进程 RSS > 节点内存配额 → **明确的 OOM 根因**
- 如果进程 RSS 远小于配额但 OOM 仍然发生 → 说明多个进程累计超过了配额

#### Grafana 监控检查（与 `grafana-observation` 分工）

**不要在本 skill 里重复写 OpenAPI / 面板 Panel 细节**——指标采集、JWT、`arena_health_check.py`、`grafana_query.py` 及 Arnold 容器资源面板说明，均以 **`merlin-grafana-observation`** 为准。

本 skill 在评估节点诊断中只需：

1. **拿到链接**：`bytedcli --site cn --vregion seed merlin job get-grafana --job-run-id <job_run_id>`，以及 Arena 返回的 `extra.arena_task_grafana_url`（Evals 业务看板）。
2. **需要佐证 OOM / 资源瓶颈时**：按 **`grafana-observation`** 跑一键检查，例如（具体参数以该 skill 为准）：
   ```bash
   python3 skills/bytedance-merlin/references/merlin-grafana-observation/scripts/arena_health_check.py \
     --eval-sid "<evaluation_task_sid>"
   ```
3. **日志中的 cgroup OOM**：仍以 head/worker **stdout** 里的 `Memory cgroup out of memory` 为准；指标侧用 grafana-observation 的 Arnold Role/Container 看板交叉验证。

| 维度 | 本 skill | `grafana-observation` |
|------|----------|------------------------|
| Arena 多节点判定、退出码、ray_log | 主责 | 不覆盖 |
| Evals 看板 + Arnold 资源曲线、自动化报告 | 只引用 | 主责 |

#### Ray MemoryMonitor 检查

通过 TLS 日志确认 Ray 的 MemoryMonitor 是否启用：

```bash
bytedcli --site cn --vregion seed merlin job get-tls-log \
  --job-run-id <job_run_id> \
  --trial-id <trial_id> \
  --query "trial_id='<trial_id>' AND kubernetes_pod_name='<head_pod>' AND _msg CONTAINS('memory_monitor')" \
  --start <start_ts> \
  --end <end_ts> \
  --limit 10
```

如果看到 `MemoryMonitor disabled`，说明 Ray 不会主动记录内存警告，此时需要依赖 Grafana 监控或内核 OOM 日志来判断内存状况。

#### Pod 退出码

参见第二步中的**全节点退出码速查表**，评估节点常见的额外退出码：`255`（用户脚本异常退出，查 ray_log）、`10005`（Arnold OOM，查 Grafana）。

#### 日志分析

**默认看多少行**：skill 不强制固定行数；按「先够定位、不够再加」分层，避免只看 **100 行** 导致长 Traceback / 多次报错看不全。

**head / worker 的 stdout、stderr**（平台 log-proxy URL）：

1. **第一遍**：各拉取**尾部约 800～1500 行**（或体积上限约 512KB～1MB 内能接受的行数），错误与 OOM 多在末尾附近：
   ```bash
   no_proxy=* curl -sS "<log_url>" | tail -n 1200
   ```
2. **若仍像「包装错误」**（如仅 `failed to execute user script with exit code`）或无明显根因：扩大到 **`tail -n 3000`** 或对该 URL 全量下载后再搜关键词。
3. **head 与 worker 各看一份**；OOM、cgroup 信息可能只在其中一侧。

**ray_log**（见下节）：通常**不按 tail 行数代替全文检索**——先对整段日志做 **grep / ripgrep** 定位行号，再对命中位置 **带上下文展开**（例如每处前后各 30～80 行），Traceback 往往远长于 100 行。

重点关注以下错误模式，并注意**区分根因与伴随现象**：

1. **推理服务不可达**（通常是根因）
   - 关键词：`get_one_request_url got empty url`, `XGPTServerAPI`, `ray_serve_client`
   - 含义：XGPT Serving 节点不可用，评估无法获取模型推理结果
   - evals 框架的 `ExceptionManager` 会标注 `Root causes of abnormal exit: ['infer_scheduler_process']`
   - 修复：排查推理服务节点，确认 GPU 资源和模型权重路径

1a. **推理服务间歇性 500 / DistStoreError**（通常指向 Serving 节点 CUDA OOM）
   - 关键词：`CustomApiError (err_code=500)`, `DistStoreError: Socket Timeout`, `dp_coord`, `Timed out waiting 1800000ms for send operation`
   - 含义：Serving 节点的某个 DP rank 发生 CUDA 显存 OOM，导致 DP 通信超时，返回 500 给评估节点
   - **与"推理服务不可达"的区别**：不可达是完全断连（`got empty url`），此模式是间歇性 500 错误——推理服务仍在运行但部分请求失败
   - **必须动作**：去查 **Serving 节点各 worker 的 stdout 日志**（第三步A 的 CUDA OOM 检查），确认是否有 `torch.OutOfMemoryError`
   - 修复：见场景 9

2. **OOM（内存溢出）**
   - 关键词：`Memory cgroup out of memory`, `Killed process`, `OOM`
   - 含义：容器内进程占用内存过多，被 cgroup 杀死
   - **报告写法**：**仅当**日志里出现 **`Memory cgroup out of memory: Killed process ...`** 等铁证时，在根因分析中**明确写出**「哪颗 Evals Pod、杀了什么进程」；可结合 **exit 137** 与监控佐证。**不是 OOM 时不要单独开段写「未发生 OOM」**——直接按真实根因（序列化错误、依赖缺失、Serving 断连等）写清楚即可。
   - **与 `infer_scheduler_process` / Serving 断连**：二者可同时存在；若日志里**既有** cgroup OOM **又有** XGPT 断连，按**时间戳**写清先后，避免只复述 ExceptionManager。
   - **被杀进程的 `oom_score_adj`**：`1000` 多为 cgroup 优先牺牲的低优先级子进程。
   - 修复：增加对应 **worker**（或 head）内存、减少并发、降低推理侧积压

3. **evals 框架异常**（上层包装，不是根因）
   - 关键词：`Evaluation failed abnormally`, `RuntimeError`, `cleanup_all`
   - 含义：evals 框架检测到评估流程异常退出
   - 代码位置：`evals/evaluator/evaluator.py` → `_clean()` → `resource_manager.cleanup_all()`
   - 这是一个**上层包装错误**，真正的根因在 `ExceptionManager` 的 `Root causes` 或其他日志中

4. **用户脚本退出**（最终错误，不是根因）
   - 关键词：`failed to execute user script with exit code`
   - 含义：Arnold entrypoint 检测到用户脚本非零退出
   - 这是**最终报错**，需要往上查找真正的根因

### 第四步：分析 exercise 级别失败

从 `progress.detail` 中识别失败的 exercise：

```python
for exercise_key, info in progress_detail.items():
    completed = info.get("completed", 0)
    total = info.get("total", 0)
    status = info.get("status", "")
    if completed == 0 and status != "completed":
        # 完全没有跑的 exercise，可能是推理服务不可达
        pass
    elif completed < total and status == "uncompleted":
        # 部分完成的 exercise，可能是中途 OOM 或超时
        pass
```

统计完成率以判断失败范围：
- **全部 exercise 都是 0 完成**：大概率推理服务节点未启动
- **部分 exercise 有完成**：推理服务曾经工作过，后来中断
- **仅个别 exercise 失败**：可能是特定评估模块代码问题

### 第五步：深入分析评估节点错误（仅在第二步判定为评估节点失败时执行）

评估节点的代码由两层组成：
- **evals-sdk**（框架层）：`bytedance-evals` 包，通过 pip 安装。包含 evaluator、ExceptionManager、model provider、inference 调度、resource_manager 等框架代码
- **evals**（业务层）：**`seed/evals` 仓库**（与 Job 的 `git_repo` commit 对齐），含 `evals/modules/` 等，运行在框架之上

两层的日志混在一起输出，但代码来自不同制品。根据 traceback 路径区分：
- `.../site-packages/bytedance/evals/...` → evals-sdk 框架层
- `/opt/tiger/evals/evals/modules/...` → evals 业务层（对应 `seed/evals` 源码）

#### 查看 ray_log 而非 stdout/stderr

**关键**：evals-sdk 的错误通常出现在 **ray_log** 中，而不是 head/worker 的 stdout/stderr。stdout/stderr 中通常只有 Arnold entrypoint 的包装错误（`failed to execute user script with exit code 255`），没有实际价值。

分析步骤：
1. 拉取 `ray_log` 全文或流式管道，用 **grep -n**（或 `rg -n`）定位关键词行号，不要只 `tail -100` 代替 ray_log。
2. 对每个命中行用 **上下文** 展开阅读（Traceback + ExceptionManager 常连续多行），例如：
   ```bash
   no_proxy=* curl -sS "<ray_log_url>" | grep -n -E "ERROR|CRITICAL|Traceback|RuntimeError|ModuleNotFoundError|Root causes|ExceptionManager" -i
   # 假定关键行在 88420，则抽一段足够长的窗口（示例 200 行）：
   no_proxy=* curl -sS "<ray_log_url>" | sed -n '88320,88520p'
   ```
   或用 `grep -E -n ... | head` 先锁定**最早出现的** ERROR/Traceback（更接近根因），再对该行号区间 `sed -n 'START,ENDp'`，`END-START` 建议 **≥120 行**（复杂栈更深时再加大）。
3. 找到 `ExceptionManager` 的 `Root causes` 与进程退出行，再回溯同一段内的完整 Traceback。
4. 若 ray_log 体积极大、curl 超时：优先用 Ray 历史页/平台日志切片，或 `diagnose_arena_task.py` 做本地落盘后再 `rg`。

**不推荐**：仅凭 **stdout/stderr 最后 100 行** 就下结论（易截断）；**100 行**仅可作极快扫一眼用。

#### 常见 evals 错误分类

**1. Exercise/eval class 不支持**
```
RuntimeError: Exercise version SID [xxx], eval class [yyy] is not supported
```
- 含义：exercise 配置中指定的 eval class 在当前 evals-sdk 版本中没有注册
- 代码位置：`evaluator.py` → `_init_exercises()`
- 原因：eval class 是新开发的模块，尚未合入 evals 主线或未发布到 pip 包
- 修复：使用包含该 eval class 的 evals 分支/commit，或更新 pip 包版本

**2. Python 依赖缺失**
```
ModuleNotFoundError: No module named 'xxx'
```
- 含义：评估代码引用了未安装的 Python 包
- 常见场景：自定义分支新增了 model provider 或评估模块，但没有把依赖加入 pip 列表
- 代码位置：通常在 `provider_factory.py` → `registry.get()` → `importlib.import_module()` 时触发
- 修复：在 evals 仓库的 `configs/ray_init_config.yaml`（或任务实际使用的 pip/runtime 配置）中补充缺失依赖

**3. ExceptionManager 报告的进程级异常退出**

ExceptionManager 是 evals-sdk 的异常监控组件，会记录哪些核心进程异常退出：

```
[ExceptionManager]Root causes of abnormal exit: ['xxx_process']
[ExceptionManager]process: xxx_process exit with code: N
```

| 进程名 | 作用 | 常见退出原因 |
|--------|------|-------------|
| `model_inference_process` | 模型推理（初始化 provider、调用 API） | provider 加载失败、依赖缺失、API 配置错误 |
| `infer_scheduler_process` | 推理调度（管理推理请求队列） | 推理服务不可达、XGPT Serving 停止 |
| `instance_evaluate_process` | 评估实例执行（运行 metric 计算） | OOM（exit code -9）、评估代码 bug |
| `prompt_assembler_process` | 提示词组装（数据预处理+拼接 prompt） | 数据格式错误、业务代码 bug（IndexError 等） |
| `preprocess_process` | 数据预处理 | 数据格式错误、数据源不可访问 |

exit code 含义：
- `1`：Python 异常（查 traceback 定位具体错误）
- `-9`：SIGKILL（通常是 OOM killer）
- `-15`：SIGTERM（被系统或框架主动终止）

**4. 评估初始化阶段失败（启动后很快失败）**
```
[evaluator.py] Evaluation failed: Traceback ...
```
- 如果 `evaluator.py:run()` 在 `_init_exercises()` 阶段就抛出异常，说明是配置或环境问题，不是运行时错误
- 典型原因：eval class 不支持、配置格式错误、依赖缺失
- 特征：任务启动后几分钟内就失败，0 个 exercise 完成

**5. 推理调用失败（运行时错误）**
```
RuntimeError: [XGPTServerAPI]ray_serve_client.get_one_request_url got empty url
```
- 含义：推理服务不可达
- 代码路径：`model/external_api/xgpt_server_api.py` → `_get_base_url_by_ray_client()`
- 修复：排查推理服务节点状态

**6. 上层包装错误（不是根因，需要继续往下查）**
```
RuntimeError: Evaluation failed abnormally
```
- 代码路径：`evaluator.py` → `_clean()` → `resource_manager.cleanup_all()`
- 这只是框架检测到有进程异常退出后的清理逻辑，不是真正根因
- 需要查看 `ExceptionManager` 的 `Root causes` 来确定真正失败的进程

#### 从 Merlin Job 元数据获取 evals 分支、commit 与 SDK 版本（代码排查前必做）

当需要根据 traceback 中的文件路径到**真实仓库**核对实现时，不要只猜分支：用评估节点（`job_run_id`）的 Job 定义一次性取出主仓、子仓与 pip 里的 **evals-sdk** 版本。

```bash
bytedcli --site cn --vregion seed merlin job get-run --job-run-id <job_run_id>
```

| 取值位置（JSON 路径） | 含义 |
|----------------------|------|
| `job_run.meta.job_def_version.git_repo` | 主仓：`repo_name`（如 `seed/evals`）、`branch_name`、`commit_sha`、挂载点 `mnt`（常为 `/opt/tiger/evals`） |
| `job_run.meta.job_def_version.sub_repos[]` | 子仓：如 `seed/xgpt_server`、`seed/swalm_agent` 各自的 `branchName` / `commitSha` / `mnt` |
| `job_run.meta.job_def_version.resource.arnold_config.rayOnArnoldConfig.runtimeEnv` | **字符串化的 JSON**，其中 `pip` 数组含 `bytedance-evals[all]==x.y.z`（及 `-U` 等 flag），即运行时 **evals-sdk** 版本 |

**本地临时拉代码核对（Agent 操作约定）**

1. 仅用于对照本次任务：`git clone` / `git fetch` 后 `git checkout <commit_sha>`（主仓与子仓分别按上表）。
2. 核对 traceback 指到的路径：主仓多为 `/opt/tiger/evals/...`；SDK 侧用 `pip download 'bytedance-evals==<runtimeEnv 中的版本>'` 解 wheel，读 `.dist-info/METADATA` 的 `Version` 与任务一致后，再在解压出的 `bytedance/evals/...` 中对照栈文件行号（避免本地误装其它小版本）。
3. **看完即删**：`rm -rf` 临时 clone 目录，避免工作区长期残留大仓库。

Arena 顶层 `arena_evaluation.branch` / `commit_sha`（及 `extra.create_branch` / `create_commit_sha`）通常与主仓一致，但以 **`job get-run` 的 `git_repo` 为准**（含 `sub_repos` 与 `runtimeEnv`）。

#### 日志中的路径区分

```
# evals-sdk 框架层（pip 安装的 bytedance-evals 包）
.../site-packages/bytedance/evals/evaluator/evaluator.py
.../site-packages/bytedance/evals/core/inference/model_inference.py
.../site-packages/bytedance/evals/model/provider_factory.py

# evals 业务层（seed/evals 源码，Job 内挂载为 /opt/tiger/evals）
/opt/tiger/evals/evals/modules/llm_singleturn/...
/opt/tiger/evals/evals/model/starling_translate_provider.py
```

- 框架层错误多为环境/配置问题（版本不匹配、依赖缺失、不支持的 eval class 等）
- 业务层错误多为评估逻辑 bug，在 **`job get-run` 对齐的 `seed/evals` commit** 上查对应文件

### 第六步：输出诊断报告

对用户回复时**采用下列结构**（可按任务删减无关节点行，但保留 1 概要、4 根因、5 日志、7 修复）：

```markdown
## 失败诊断报告

### 1. 概要
一句话写清根因（错误类型、栈或节点）。根因是 cgroup OOM 时自然写出即可；否则不必单独强调「非 OOM」。

### 2. 任务信息
- 评估任务 SID、Arena SID、Job Run ID、Trial ID、状态、创建/完成时间

### 3. 节点状态
| 节点 | 状态 | 退出码 | 诊断结论 |
|------|------|--------|----------|
| XGPT Preshard / Serving / Evals head-0 / worker-0 … | … | … | … |

### 4. 根因分析
从触发失败的第一环写到框架包装（如 `Evaluation failed abnormally`）。OOM 类根因写清 Pod 与日志引文即可。

### 5. 关键日志摘录
最具代表性的若干行。

### 6. Exercise 完成情况
完成/失败/未开始的 exercise 与样本数。

### 7. 修复建议
可执行的下一步。
```

**按表现反查典型场景**（长文）：阅读 `references/failure-scenarios.md` 对应小节，与第二、三步结论交叉验证。

**诊断完成标准（输出报告前必须逐项自检）**：

| # | 检查项 | 必须满足 |
|---|--------|---------|
| 1 | Status Graph API | 已执行，获取了所有节点的 `merlin_job_sid` |
| 2 | 失败节点的退出码 | 已通过 `list-trial-exit-info` 获取，检查了**所有 Pod**（head + 每个 worker） |
| 3 | 失败节点的日志 | 已通过 `list-trial-logs` 获取日志 URL，并**实际读取了 worker stdout 内容** |
| 4 | 根因描述 | 包含**具体的错误信息**（退出码数值、日志中的 Traceback 或错误行），而非仅复述 API 状态字段（如「Preshard Failed」「CREATE_MERLIN_JOB_FAILED」） |
| 5 | 修复建议 | 基于具体根因给出可执行的下一步，而非泛泛的「检查资源配额」 |
| 6 | **-77777 场景专项**（仅当 Serving 退出码为 -77777 时） | 已对比 Serving 和 Evals 两侧时间线，报告中**写明了低利用率的具体原因**（Evals 排队太久 / Server 配置问题 / 确实空闲率过高等），而非仅写「低利用率被查杀」 |

> **如果你只做到了「判断出是哪个节点挂了」但还没有拿到退出码或日志内容，说明诊断尚未完成，必须继续执行第三步。不要把未完成的中间结论作为最终报告输出给用户。**

## 关联技能

- `grafana-observation`：**Grafana 指标与自动化健康检查**（Evals 看板 + Arnold 资源、`unreclaimable_ratio`、OpenAPI）；Arena 失败分析里凡涉及「看监控佐证 OOM/慢/资源」优先复用，避免重复文档
- `arena`：Arena 评估数据拉取
- `merlin-job-debug`：通用 Merlin Job 失败排查
- `job-operations`：查看日志与 Pod 运维
- `job-resource`：资源配额查询
