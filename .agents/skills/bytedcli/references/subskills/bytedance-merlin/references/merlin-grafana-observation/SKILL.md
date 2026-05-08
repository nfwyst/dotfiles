---
name: merlin-grafana-observation
description: >-
  Grafana 指标维度的 Arena/Job 任务检查。通过 Grafana OpenAPI 采集 Evals 业务指标
  （完成度、QPM、P99 耗时、batch_size、mem_rss、推理轮数）和 Arnold 容器资源指标
  （CPU、内存、磁盘、网络、GPU），检测指标层面的异常并生成可视化报告。
  注意：本 skill 仅覆盖 Grafana 指标检查，不包含日志分析、Pod 退出码诊断、
  时间线事件分析等其他维度的排查，这些由其他 skill 负责。
  当用户提到以下关键词时使用本 skill：Grafana、看板、监控、metrics、
  资源瓶颈、内存异常、CPU 打满、推理延迟、完成度、QPM、P99、GPU 利用率、
  arena health check、指标检查。
---

# Grafana 观测：Arena/Job 任务指标检查

## 定位

本 skill 是任务健康检查中 **Grafana 指标维度** 的检查方案，负责采集和分析时序指标数据。

一次完整的任务问题排查通常包含多个维度，本 skill 只覆盖其中的指标部分：

| 检查维度 | 覆盖方 | 说明 |
|----------|--------|------|
| **Grafana 指标** | **本 skill** | Evals 业务指标 + Arnold 容器资源指标 |
| 日志分析 | 其他 skill | 任务日志、错误堆栈、stderr |
| Pod 退出码 | 其他 skill | `list-trial-exit-info`、OOM/抢占/超时判定 |
| 时间线事件 | 其他 skill | `get-timeline`、任务生命周期事件 |
| 配置审计 | 其他 skill | 资源配置合理性、entrypoint 参数 |

## 目标

从 **Arena URL、evaluation_task_sid 或 trial_id** 出发，采集 Evals 业务指标和 Arnold 容器资源指标，自动检测指标层面的异常并以 **Markdown 表格**（默认）或 **HTML 报告** 呈现结果。也支持手动查询任意 Grafana 面板。

## 认证

Grafana OpenAPI 使用 **字节云 JWT** 认证，可直接复用 bytedcli merlin 已有的 SSO 登录 token。

```bash
# JWT 来源：通过 bytedcli merlin 获取（与其他 skill 保持一致，不直接读取 auth 文件）
JWT_TOKEN=$(bytedcli --site cn --vregion seed merlin login get-jwt)
```

如果 JWT 过期（401），执行 `bytedcli auth login` 重新登录。

## Arena 健康检查（主流程）

用户给出 Arena URL 或 `evaluation_task_sid` 时，执行以下流程：

### 一键脚本

```bash
python skills/bytedance-merlin/references/merlin-grafana-observation/scripts/arena_health_check.py \
  --eval-sid <evaluation_task_sid>
# 或从 URL 解析
python skills/bytedance-merlin/references/merlin-grafana-observation/scripts/arena_health_check.py \
  --arena-url "https://seed.bytedance.net/evaluation/arena/xxx?evaluation_task_sid=yyy"
# HTML 格式输出
python skills/bytedance-merlin/references/merlin-grafana-observation/scripts/arena_health_check.py \
  --eval-sid <sid> --format html -o report.html
```

脚本自动完成以下步骤，输出 Markdown 报告（含异常表格）。

### Status Graph（Serving / Preshard 等非评估主节点）

Arena 链路除主评估 Job 外，还可能包含 **Serving、Preshard** 等独立节点。仅依赖 `arena get-evaluation` 与主 `arnold_trial_id` 的 `job get-grafana` 时，往往只能覆盖评估侧；需要这些节点的 **Grafana 链接** 或 **Job ID** 时，应先拉取 Status Graph，从返回中的 `grafana_url` 等字段拿到各节点信息，再对目标节点的 `trial_id` 继续本 skill 后续的 `job get-grafana`、OpenTSDB 查询等步骤。

```bash
# Arena 场景下获取各节点的 Grafana 链接和 Job ID（Status Graph 返回中包含 grafana_url 字段）
bytedcli --site cn --vregion seed merlin arena get-evaluation-status-graph --arena-evaluation-sid <evaluation_task_sid>
```

### 手动步骤（脚本失败时的 fallback）

**Step 1**: 获取任务信息

```bash
bytedcli --site cn --vregion seed merlin arena get-evaluation --sid <eval_sid>
```

> 注意参数是 `--sid`（不是 `--evaluation-task-sid`），且不需要 `--output json`（默认 JSON）。
> 返回结构为 `{"arena_evaluation": {...}}`，取内层。

提取：`arena_sid`、`arnold_trial_id`（取最近一个 trial）、`created_at`/`completed_at`（时间范围）、`status`、`resource_config`。

**Step 2**: 获取 cluster 和 dc

```bash
bytedcli --site cn --vregion seed merlin job get-grafana --trial_id <arnold_trial_id>
```

> 注意参数是 `--trial_id`（下划线），返回 `{"grafana_url": "..."}`。

从返回 URL 的 query string 中提取 `var-cluster` 和 `var-dc`。

**Step 3**: 采集 Evals 业务指标（Evals 看板 `ejyXFpTHk`）

依次查询以下 Panel，使用 Grafana OpenAPI `screenshot` + `only_data=true`：

| Panel | 观测内容 | 异常判断 |
|-------|---------|----------|
| 138 | 完成度 | finished=0 → 任务未完成 |
| 136 | 各阶段 P99 耗时 | 哪个阶段最慢 |
| 184 | chat_completion QPM | 推理吞吐 |
| 183 | chat_completion P99 | >60s 偏高，>300s 严重 |
| 146 | 进程 mem_rss | >30GB 偏高 |
| 120 | batch_size | =1 表示未 batching |
| 186 | 未完成 instance 数量 | >500 堆积 |
| 191 | 最大推理轮数 | >50 可能 Agent 循环 |

**Step 4**: 采集 Arnold 容器资源（Arnold Role 看板 `JiidrBwGzrole`）

对 head 和 worker 分别查询：

| Panel | 观测内容 | 异常判断 |
|-------|---------|----------|
| 2 | CPU 利用率 | >90% 打满 |
| 40 | CPU Throttle | >0 被限流 |
| 3 | Memory (usage/limit/rss/cache) | usage > limit → OOM，>90% → 风险 |
| 4 | Disk (container/total) | 接近 total → 磁盘满 |
| 5 | Network (rx/tx) | 骤降 → 网络中断 |
| 7 | GPU DutyCycle | worker <10% → GPU 闲置 |
| 6 | GPU Memory | 接近 total → 显存不足 |

> **⚠️ mem_limit 准确性警告**：Arnold Role 看板的 `lab.arnold.instance_monitor.mem_limit` 可能不准确（实测可能只报容器 limit 的一半）。
> 如需确认真实的 TCE cgroup 内存限制，应查询 **Arnold Container 看板**（`LgKuxDjSz`）的 **Panel 119**，
> 使用 `tce.container.mem_usage.mt` 的 `limit` 字段，该值为 TCE 容器实际 cgroup limit，更可靠。
> 详见 `references/arnold-role-dashboard.md` 中「mem_limit 准确性」章节。

**Step 5**: 输出报告

默认 Markdown 格式，包含：任务概况表 → 异常摘要表（分 🔴严重/🟡警告/🔵提示） → 各指标详情。用户要求 HTML 时切换 `--format html`。

### 数据保留期限

> **Evals 业务指标**（`seed.evals.*`）在 OpenTSDB 中保留时间较短（约 1-3 天），过期后查不到数据。
> **Arnold 容器资源指标**（`lab.arnold.instance_monitor.*`）保留时间较长（约 7-14 天）。
> 对于已结束较久的任务，脚本可能只能采集到 Arnold 资源指标。

### 异常判断规则

- **超过 limit**：`mem_usage > mem_limit` 或 CPU 利用率 >90% → 🔴 严重
- **接近 limit**：使用率 >90% limit → 🟡 警告
- **推理延迟**：P99 >60s → 🟡，>300s → 🔴
- **Agent 循环**：最大推理轮数 >50 → 🟡
- **低效推理**：batch_size=1 → 🔵 提示
- **任务失败/超时**：status=FAILED/TIMEOUT → 🔴

## 手动面板查询（进阶用法）

### 流程 1：了解看板结构

当需要知道「看板有哪些面板」时：

```bash
curl -s 'https://cloud.bytedance.net/api/v1/grafana_open_api/dashboards/description' \
  -H "X-JWT-Token: $JWT_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"url": "<grafana_dashboard_url>"}'
```

返回包含 `dashboard_panels[].panels[]`，每个 panel 有 `id`、`title`、`type`、`targets[]`（查询配置）和 `grafana_link`。

### 流程 2：获取 Panel 结构化数据

当需要获取面板的 **实际时序数据** 时：

```bash
curl -s 'https://cloud.bytedance.net/api/v1/grafana_open_api/screenshot' \
  -H "X-JWT-Token: $JWT_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{
    "url": "<grafana_panel_url_with_viewPanel=ID>",
    "only_data": true
  }'
```

**关键**：URL 中必须带 `viewPanel=<panel_id>` 参数才能定位到具体 Panel。

返回结构：
```json
{
  "count": 1,
  "total": [{
    "url": "实际查询的数据源 URL",
    "data": [{"metric": "...", "tags": {...}, "dps": {"timestamp": value}}],
    "payload": "实际发送的查询 body",
    "size": 4412
  }]
}
```

### 流程 3：获取 Panel 截图

当需要 **可视化图片** 时：

```bash
curl -s 'https://cloud.bytedance.net/api/v1/grafana_open_api/screenshot' \
  -H "X-JWT-Token: $JWT_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{
    "url": "<grafana_panel_url_with_viewPanel=ID>",
    "width": 1920,
    "height": 1080
  }' --output panel.png
```

### 流程 4：解析查询变量

当 Panel targets 中有模板变量（如 `${arena_instance_id}`）需要解析为实际值时：

```bash
curl -s 'https://cloud.bytedance.net/api/v1/grafana_open_api/expr/parse' \
  -H 'Content-Type: application/json' \
  --data '{"url": "<grafana_dashboard_url_with_vars>"}'
```

## 脚本工具

封装了常用查询，避免每次手动拼 curl：

```bash
# 获取看板结构
python skills/bytedance-merlin/references/merlin-grafana-observation/scripts/grafana_query.py describe \
  --url "https://grafana.byted.org/d/ejyXFpTHk/..."

# 获取 Panel 数据
python skills/bytedance-merlin/references/merlin-grafana-observation/scripts/grafana_query.py panel-data \
  --url "https://grafana.byted.org/d/ejyXFpTHk/..." \
  --panel-id 138

# 获取 Panel 截图
python skills/bytedance-merlin/references/merlin-grafana-observation/scripts/grafana_query.py screenshot \
  --url "https://grafana.byted.org/d/ejyXFpTHk/..." \
  --panel-id 138 --output panel.png
```

## 三类看板

Evals 任务的 Grafana 监控分为三个看板：

| 类别 | 看板 | UID | 数据来源 | 说明 |
|------|------|-----|---------|------|
| **业务指标** | Evals 用户任务监控 | `ejyXFpTHk` | Evals 程序自身上报 | 任务进度、QPM、P99 耗时、推理吞吐等 |
| **容器资源（Pod级）** | Arnold Docker Container Metrics | `LgKuxDjSz` | TCE 容器采集 (`tce.container.*`) | CPU、内存（通过 `_pod_name` 过滤，`cluster=All`）；**mem_limit 以此看板为准** |
| **容器资源（Role级）** | Arnold 实例监控（Role级别） | `JiidrBwGzrole` | Arnold 平台采集 (`lab.arnold.instance_monitor.*`) | CPU、内存、磁盘、网络、**GPU 全量指标**（通过 `arnold_trial_id` + `arnold_role` 过滤，需精确 `cluster`） |

**排查路径**：Evals 看板发现问题（慢/失败） → Arnold Role 看板查完整资源（含 GPU）→ 不知 cluster 时退回 Container 看板。

> **⚠️ 内存 limit 交叉验证**：Arnold Role 看板的 `mem_limit` 可能不准确。如果内存分析结论依赖 limit 值，
> 务必用 Arnold Container 看板 Panel 119 的 `tce.container.mem_usage.mt` limit 字段交叉验证。

## 渐进披露

- **Grafana OpenAPI 详细用法** → **`references/grafana-openapi.md`**
- **Evals 看板面板与排查场景映射** → **`references/evals-dashboard.md`**
- **Arnold 容器资源看板（Pod级）指标映射** → **`references/arnold-container-dashboard.md`**
- **Arnold 实例监控看板（Role级）指标映射** → **`references/arnold-role-dashboard.md`**（首选，GPU 全量指标）

## 已验证的看板

| 看板 | Dashboard UID | 数据源 | 说明 |
|------|--------------|--------|------|
| **Evals 用户任务监控（重构版）** | `ejyXFpTHk` | 3337 (OpenTSDB) | 评测任务进度、耗时、QPM、资源、推理、Metric |
| **Arnold Docker Container Metrics** | `LgKuxDjSz` | 52834 (OpenTSDB) | 容器级 CPU / 内存（通过 `_pod_name` 过滤，`cluster=All`）；**mem_limit 权威来源** |
| **Arnold 实例监控（Role级别）** | `JiidrBwGzrole` | 52834 (OpenTSDB) | **首选** — 完整 CPU / 内存 / 磁盘 / 网络 / GPU（通过 `arnold_trial_id` + `arnold_role` 过滤，需精确 `cluster`） |

## 从 Evals ID 关联 Arnold 看板

1. 通过 `bytedcli merlin arena get-evaluation` 获取 `arnold_trial_id`
2. 通过 `bytedcli merlin job get-grafana --trial-id <TRIAL_ID>` 获取含 `cluster` 和 `dc` 的看板 URL
3. **优先用 Role 看板**（`JiidrBwGzrole`）：指标最全，含 GPU，用 `arnold_trial_id` + `arnold_role` 过滤
4. 不知 cluster 时退回 Container 看板（`LgKuxDjSz`）：用 `_pod_name` 过滤，`cluster=All`

> **重要**：
> - 不要用 Evals 看板的 Panel 19/21 查 CPU/Memory，其 ClickHouse 数据源依赖 `arnold_cluster` 变量，经常解析错误。
> - Role 看板（`JiidrBwGzrole`）**必须精确指定 `cluster` 和 `dc`**，否则返回空数据。
> - Container 看板（`LgKuxDjSz`）可用 `cluster=All`，但没有 GPU 指标。
> - **Head 节点通常没有 GPU**，GPU 指标只在 worker 角色有。
> - **`lab.arnold.instance_monitor.mem_limit` 可能不准确**，需要用 `tce.container.mem_usage.mt` limit 交叉验证。

## 与其他检查维度的配合

本 skill 产出的是 **指标层面** 的异常线索，通常需要结合其他维度才能定位根因：

```
用户报告"任务失败/任务慢"
├── [本 skill] Grafana 指标检查
│   ├── 进度卡在哪个阶段？哪个阶段最慢？
│   ├── 资源有无瓶颈？（OOM / CPU 打满 / GPU 闲置）
│   └── 输出：异常指标列表 + Grafana 看板链接
│
├── [其他 skill] 日志分析
│   └── 具体错误堆栈、失败原因
│
├── [其他 skill] Pod 退出码诊断
│   └── exit_code 10005=OOM / 60007=被删除 / ...
│
├── [其他 skill] 时间线事件分析
│   └── 任务生命周期关键事件
│
└── 综合以上维度 → 定位根因 → 给出修复建议
```

**典型组合场景**：
- **任务失败**：本 skill 发现内存接近 limit → 退出码确认 OOM → 日志定位泄漏点
- **任务慢**：本 skill 发现推理 P99 偏高 → 日志分析 Server 响应延迟原因
- **资源异常**：本 skill 发现 GPU 利用率低 → 配置审计检查是否分配合理
