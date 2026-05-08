---
name: merlin-arena
description: Seed Arena 评估数据拉取（概览、分页 case）与失败排查。当用户说"拉取评估任务数据/根据 evaluation_task_sid 获取 case 得分/给我这个评估链接的详细数据/Arena 任务失败怎么查/帮我定位 Arena 失败原因/根据 Arena 链接修复"时使用。如果用户要导出 Arena 评估明细到文件/下载链接/批量导出全量 case JSON，应优先使用 `merlin-eval-result-export` skill。
---

# Arena 评估

Arena 评估数据拉取和失败任务排查。

## 前置条件

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

如果出现认证错误（401/403），运行 `bytedcli auth login`。

---

## 1. 评估数据拉取

给定 Arena 评估任务链接（带 `evaluation_task_sid`）或直接给 `evaluation_task_sid`，拉取评估概览、exercise 得分和 case 明细。

### 输入

- 完整链接：`https://seed.bytedance.net/evaluation/arena/<arena_sid>?evaluation_task_sid=<sid>`
- 或直接给 `evaluation_task_sid`（如 `3k5ywg90c169a972be`）

### CLI 命令

```bash
bytedcli merlin arena get-evaluation --sid '<evaluation_task_sid>'

bytedcli merlin arena list-case --evaluation-instance-sid xxx --exercise-version-sid yyy --limit 50

bytedcli merlin arena export-case-detail --sid xxx
```

### 推荐：使用脚本

脚本自动解析 URL、拉取概览、聚合 exercise 得分，可选拉取 case 明细。

只拉取概览与 exercise 得分：

```bash
python3 skills/bytedance-merlin/references/merlin-arena/scripts/fetch_arena_evaluation.py \
  --url "USER_URL_OR_SID" \
  --out-dir "./arena_eval_export"
```

同时拉取 case 明细：

```bash
python3 skills/bytedance-merlin/references/merlin-arena/scripts/fetch_arena_evaluation.py \
  --url "USER_URL_OR_SID" \
  --out-dir "./arena_eval_export" \
  --fetch-cases \
  --max-exercises-for-cases 10 \
  --cases-per-exercise 50
```

全量导出时，把 `--max-exercises-for-cases` 设为 `0`。但如需生成可下载的完整明细文件（TOS JSON / 飞书表），推荐优先使用 `merlin-eval-result-export` skill 的后台导出任务，效率更高且不易超时。

### 输出文件

- `arena_evaluation.raw.json`：原始输出
- `exercises.csv`：每个 exercise 的基础信息与得分
- `report.md`：可读摘要
- `cases/*.jsonl`：（开启 `--fetch-cases` 时）每个 exercise_version_sid 一个文件

交付时给出 `report.md` 要点摘要和文件路径。

---

## 2. 失败任务排查

通过 Arena URL 定位关联的 Merlin Job，委托 `merlin-job-debug` 完成根因分析。

### 多节点状态（Status Graph）

当需要查看评估任务在 **Preshard / Serving / Evaluation** 等节点的状态流转、各节点 Merlin Job ID、Grafana 链接时，可先拉取 Status Graph，再针对问题节点继续下方步骤或委托 `merlin-job-debug`。

```bash
# 获取评估任务的多节点状态流转图（包含 Preshard/Serving/Evaluation 各节点的 Job ID、状态、Grafana 链接）
bytedcli --site cn --vregion seed merlin arena get-evaluation-status-graph --arena-evaluation-sid <evaluation_task_sid>
```

### 步骤

1. **解析 Arena URL → Merlin Job**

```bash
bytedcli merlin arena get-job-from-url --arena-url '<arena_page_url>'
```

从返回中提取 `result.job_url` 或 `result.job_run_id`，拼接为 Job 链接：
`https://ml.bytedance.net/development/instance/jobs/<job_run_id>`

兜底（MCP 工具不可用时）：

```bash
bytedcli merlin arena get-evaluation --sid '<evaluation_task_sid>'
```

多个候选时，用 `bytedcli merlin job get-run` 对比 `status` 与 `startTime`，选最近失败的 Job。

2. **委托 troubleshoot-failure**

将解析到的 Merlin Job 链接传给技能 `merlin-job-debug`，由其完成失败信息拉取、根因归因和修复建议。

### 输出格式

1. **失败概述**：一句话总结
2. **关键信息**：Job ID、Trial ID、退出码、失败时间
3. **诊断依据**：关键日志摘录
4. **修复建议**：具体到资源/入口/依赖
5. **自动修复结果**（如有）：新任务链接与结果

---

## 3. Arena 配置查询

可以查询 Merlin Arena 的配置列表或获取指定配置的详细信息。

### CLI 命令

列出 Arena 配置：

```bash
bytedcli merlin arena list-config --limit 10 --offset 0
```

获取指定 Arena 配置的详情：

```bash
bytedcli merlin arena get-config --sid '<arena_sid>'
```

## 4. 复制（Fork）评估任务

基于已有 `evaluation_task_sid` 创建一个新评估任务，可按需覆盖 Arena 版本、模型、分支/commit、评估集合、生成参数、资源、env 等。

```bash
bytedcli merlin arena fork-evaluation --source-evaluation-task-sid '<evaluation_task_sid>' --arena-sid '<target_arena_sid>' --titan-model-sids '["<titan_model_sid_1>"]'
```

不想改动的字段不传即可（默认复用原任务）。

---

## 常见排错

- `bytedcli: command not found`：先安装/升级 bytedcli
- 401/403：运行 `bytedcli auth login`
- case 太多导致慢：先只导出 `exercises.csv`，再指定 `--exercise-version-sid` 精准拉取

## 关联技能

- `merlin-arena-trajectory`：拉取 Trajectory（Trace）数据并可视化。可先用本 skill 抽取 case，再用 `merlin-arena-trajectory` 查看推理轨迹
- `merlin-eval-result-export`：Arena 评估 case 明细后台导出任务（全量导出首选，优先于本 skill 的分页脚本）
- `merlin-job-debug`：Merlin Job 失败排查与修复建议
- `merlin-insight`：Insight 分析与案例查询
- `merlin-eval-get-result`：获取评估实例指标结果
