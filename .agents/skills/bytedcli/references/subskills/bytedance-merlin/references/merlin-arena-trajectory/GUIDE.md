---
name: merlin-arena-trajectory
description: |
  从 Arena 评估拉取 Trajectory 数据，标准化为 JSONL 并生成交互式 HTML 可视化。当用户提到 trajectory、trace、推理轨迹、推理过程、model_call、推理请求/响应，贴了 arena 链接并提到轨迹相关关键词，或想分析 model 输入输出、查看 judge 打分、排查 case 推理异常时使用。即使只说"下载这个任务的 trajectory"或只贴一个 arena URL 也应使用。
---

# Arena Trajectory 拉取与可视化

## 前置条件

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

认证错误时运行 `bytedcli auth login`。

---

## 工作流

### 第一步：确定拉取范围

| 用户输入 | 操作 |
|---------|------|
| 只给了 Arena URL 或 SID | `--batch-all` 下载全部 exercise |
| 指定了 exercise + question + trial | 单条 instance 模式 |
| 给了 URL 但想选特定 case | 先用 `merlin-arena` skill 查 exercise 和 case，再转单条模式 |

### 第二步：确定输出粒度

| 目标 | 做法 |
|------|------|
| 全量树（单条分析/可视化） | 不加 `--simplify`，加 `--visualize` |
| 简化树（批量下载，去噪去重） | 加 `--simplify`（默认 blacklist） |
| 只要推理请求（扁平） | `--simplify --simplify-mode whitelist --simplify-types model_call` |
| 只要裁判请求（扁平） | `--simplify --simplify-mode whitelist --simplify-types judge_model_call` |

白名单只输出指定类型。单一类型 = 扁平列表，多类型（如 `instance,instance_loop,session,model_call`）= 层级树。类型枚举见 [references/jsonl_schema.md](references/jsonl_schema.md)。

### 命令示例

**批量 + 简化（最常用）：**

```bash
python3 skills/bytedance-merlin/references/merlin-arena-trajectory/scripts/fetch_trajectory.py \
  --arena-evaluation-sid <url_or_sid> \
  --out-dir ./trajectory_export \
  --batch-all \
  --simplify --fetch-call-details
```

**批量 + 只要推理请求：**

```bash
python3 skills/bytedance-merlin/references/merlin-arena-trajectory/scripts/fetch_trajectory.py \
  --arena-evaluation-sid <url_or_sid> \
  --out-dir ./trajectory_export \
  --batch-all --fetch-call-details \
  --simplify --simplify-mode whitelist --simplify-types model_call
```

**单条 instance + 可视化：**

```bash
python3 skills/bytedance-merlin/references/merlin-arena-trajectory/scripts/fetch_trajectory.py \
  --arena-evaluation-sid <url_or_sid> \
  --exercise-version-sid <evsid> \
  --question-sid <question_id> \
  --trial-num 0 \
  --out-dir ./trajectory_export \
  --fetch-call-details --visualize
```

### 输出结构

```
out-dir/
├── meta.json                   # 批量模式元信息
├── trajectory/                 # JSONL（每个 exercise 一个文件）
│   └── <exercise_name>.jsonl
└── html/                       # --visualize 时生成
    └── <exercise_name>.html
```

批量模式自动跳过 `trajectory/` 下已存在的 `.jsonl` 文件，中断后重跑即可断点续传。

---

## 参数速查

| 参数 | 说明 |
|------|------|
| `--arena-evaluation-sid` | Arena URL 或 SID（必填） |
| `--exercise-version-sid` | Exercise version SID（单条模式必填） |
| `--question-sid` | Sample `__internal_uuid__`（单条模式必填） |
| `--trial-num` | Instance 编号，默认 0 |
| `--out-dir` | 输出目录，默认 `./trajectory_export` |
| `--model-name` | 模型名称覆盖（一般自动获取） |
| `--simplify` | 简化 trajectory，移除噪声节点（**批量推荐**） |
| `--simplify-mode` | `blacklist`（默认）或 `whitelist` |
| `--simplify-types` | whitelist 保留的类型，逗号分隔（枚举见 [jsonl_schema.md](references/jsonl_schema.md)） |
| `--fetch-call-details` | 拉取每个节点详细 Inputs/Outputs（**推荐始终开启**） |
| `--visualize` | 生成自包含 HTML |
| `--batch-all` | 批量下载全部 exercise |
| `--cases-per-exercise` | 每个 exercise 采样 N 条（0 = 全量） |
| `--concurrency` | exercise 级别并行数，默认 10 |
| `--batch-size` | ListCalls 每批大小，默认 200 |
| `--show-errors` | 打印非完成态节点诊断 |

---

## 常见排错

| 症状 | 解法 |
|------|------|
| 401 / 403 | `bytedcli auth login` |
| 找不到 exercise | 先用 `merlin-arena` skill 确认 SID |
| trace 为空 | 确认评估任务已完成且开启了 trace 上报 |
| 批量 502 | 后端超时，脚本自动重试；持续失败减小 `--batch-size` |
| OOM | 减小 `--batch-size`（如 50）；确认已开启 `--simplify` |

## 参考资料

- [references/jsonl_schema.md](references/jsonl_schema.md) — 节点类型释义、树层级、span_data、JSONL 消费代码
- [references/trace_schema.md](references/trace_schema.md) — API 接口与原始 trace 节点格式
- `merlin-arena` — Arena 元信息。未指定具体样本时先用此 skill 查 case
- `merlin-eval-get-result` — 获取评估指标
- `merlin-insight` — Insight 分析
