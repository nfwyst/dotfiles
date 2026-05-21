---
name: merlin-arena-diff
description: 排查两个 Arena 评估任务得分差异的根因。给定两个 Arena 任务链接，对比 collection/exercise 覆盖范围、任务配置（代码版本、evals-sdk 版本、YAML 配置、环境变量）和 case 级别得分明细，找出指标波动原因。当用户说"两个 arena 任务得分不一样/对比两个评估任务/arena 评分差异/为什么两次评估分数不同/arena diff/比较 arena 结果/arena 分数波动原因/两个评估跑出来不一样"时使用。
---

# Arena 任务得分 Diff 排查

给定两个 Arena 评估任务链接，系统性排查得分差异的根因。

## 前置条件

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

认证错误时运行 `bytedcli auth login`。

## 输入

两个 Arena 评估任务链接或 `evaluation_task_sid`：

- 链接格式：`https://seed.bytedance.net/evaluation/arena/<arena_sid>?evaluation_task_sid=<sid>`
- 或直接给 `evaluation_task_sid`

下文称两个任务为 **Task A** 和 **Task B**。

---

## 推荐流程：一键对比

使用脚本完成全部排查（含 Collection 覆盖检查、任务配置 Diff、Exercise 得分对比、样本级 Diff）：

```bash
python3 skills/bytedance-merlin/references/merlin-arena-diff/scripts/compare_arena_tasks.py \
  --sid-a "<Task_A_URL_or_SID>" \
  --sid-b "<Task_B_URL_or_SID>" \
  --out-dir ./arena_diff \
  --fetch-cases --top-n 5 --cases-limit 50
```

脚本会自动完成以下所有步骤：

1. 通过 `bytedcli merlin arena get-evaluation` 拉取两个任务的完整配置
2. 对比元数据（branch / commit / model）、`conf.env`、`conf.model.extra_json`
3. 下载并对比入口 YAML 配置（自动处理 `tos://` 路径）
4. 对比 Collection 覆盖范围
5. 对比所有 Exercise 得分（按分差排序）
6. 拉取分差 Top-N exercise 的样本明细，按 `__internal_uuid__` 匹配对比 score / predict / thinking pattern / prompt 拼接
7. 输出自动根因提示

**输出**：
- 终端 Markdown 表格报告
- `./arena_diff/diff_report.json` — 结构化 JSON 报告
- `./arena_diff/task_a.raw.json` / `task_b.raw.json` — 原始 API 数据
- `./arena_diff/entrypoint_a.yaml` / `entrypoint_b.yaml` — 入口 YAML
- `./arena_diff/cases_*.json` — 样本明细（当使用 `--fetch-cases` 时）

### 仅对比 YAML 配置

如果只想比较两个已下载的 YAML 配置：

```bash
python3 skills/bytedance-merlin/references/merlin-arena-diff/scripts/compare_arena_tasks.py \
  --config-a ./arena_diff/config_a.yaml \
  --config-b ./arena_diff/config_b.yaml
```

---

## 深入排查（脚本输出不够时的手动补充）

以下步骤仅在脚本输出的信息不足以定位根因时使用。

### 获取评估任务详情

`bytedcli merlin arena get-evaluation` 返回的 `arena_evaluation` 对象包含大量对比信息：

```bash
bytedcli merlin arena get-evaluation --sid '<evaluation_task_sid>'
```

关键字段：

| 字段 | 说明 |
|------|------|
| `branch`, `commit_sha` | 代码分支和 commit |
| `titan_model_sid` | 模型 SID |
| `conf.env` | 环境变量（如 `THINKING_EFFORT`） |
| `conf.model.extra_json` | 模型额外配置（JSON 字符串，含 max_position_embeddings、truncation 等） |
| `conf.arena_collections` | 使用的 Collection 列表 |
| `entrypoint_file_yaml_tos_path` | 入口 YAML 的 TOS 路径 |
| `job_run_id`, `job_run_link` | 对应的 Merlin Job |
| `progress.detail` | 每个 exercise 的得分明细 |

### 手动拉取 Case 明细

```bash
bytedcli merlin arena list-case \
  --evaluation_instance_sid "<evaluation_task_sid>" \
  --exercise_version_sid "<exercise_version_sid>" \
  --limit 50
```

> **注意**：`--evaluation_instance_sid` 参数直接使用 URL 中的 `evaluation_task_sid`，CLI 使用独立 flag 格式（不支持 `--json` 参数）。

### 样本对比要点

按 `__internal_uuid__` 匹配同一 exercise 内的样本，对比以下字段：

| 对比字段 | 分析要点 |
|----------|---------|
| `score` | 两个任务同一样本的得分是否一致；不同则说明该样本贡献了分差 |
| `predict_0` / `predict` | 模型输出，结合 score 差异分析 |
| `predict_before_postprocess_0` | 后处理前的原始输出，可用于检查 thinking/CoT 内容 |
| `model_input_prompt_0` | prompt 拼接状况。重点检查 pattern（如是否包含 `<seed:tool_call>` 等特殊字符） |
| `validation_scores` | 多次验证的得分列表，可显示得分稳定性 |

> Payload 中的字段以 `_0`、`_1`、`_2` 结尾表示多次推理（如 3 次 pass@k），`score` 是所有推理结果的聚合。

### 下载入口 YAML（手动方式）

将 `tos://` 路径替换为 TOS URL 前缀，按优先级依次尝试：

| 区域 | URL 前缀 |
|------|---------|
| CN | `https://tosv.byted.org/obj/` |
| US-BD | `https://tosv-useastbd.byted.org/obj/` |
| US | `https://tosv-va.tiktok-row.org/obj/` |
| SG | `https://tosv-sg.tiktok-row.org/obj/` |

```bash
wget -O ./arena_diff/config_a.yaml "https://tosv.byted.org/obj/<tos_path_a>"
wget -O ./arena_diff/config_b.yaml "https://tosv.byted.org/obj/<tos_path_b>"
```

---

## 最终输出格式

汇总排查结果，形成结构化报告：

### 1. 可比性结论
- 重合 collection / exercise 数量
- 不可比的部分（如有）

### 2. 任务粒度 Diff 表
包含代码版本、SDK 版本、YAML 配置、环境变量等所有差异项

### 3. 样本级 Diff 分析
- 分差 Top 5 exercise 及分差值
- 每个 exercise 的抽样对比结论
- prompt 拼接 pattern 对比结论

### 4. 根因总结
- 列出最可能导致分数差异的原因（按可能性排序）
- 给出后续排查或修复建议

---

## 常见 Diff 根因模式

排查时优先检查以下高频原因：

| 根因模式 | 典型表现 | 影响分析 |
|----------|---------|---------|
| `THINKING_EFFORT` 不同 | `no` vs `high`/`medium`/`low` | 开启 thinking 后模型推理更深入，通常正向提升（尤其推理类题目），但可能引入幻觉（尤其身份识别无 SP 场景） |
| 代码 commit 不同 | `commit_sha` 不一致 | 代码变更可能修改 prompt 拼接、后处理、评分逻辑 |
| 模型不同 | `titan_model_sid` 不一致 | 不同模型能力不同，直接影响指标 |
| 截断配置不同 | `max_position_embeddings` / `truncation_override_config` 差异 | 长文本截断策略不同导致信息丢失 |
| Prompt 拼接不同 | `use_chatml` / `think_mode` / 特殊 token 差异 | 影响模型接收的 prompt 格式 |
| 环境变量差异 | `THINK_START_TOKEN` / `AGENT_MESSAGE_BEGIN_TOKEN` 等 | 特殊 token 不同影响 parsing 逻辑 |
| Collection/Exercise 不同 | exercise 列表不一致 | 评估内容本身不同，不具可比性 |
| `temperature` / `top_p` 不同 | 采样参数差异 | 影响生成的随机性和多样性 |
| `system_prompt_override` 不同 | `true` vs `false` | 是否覆盖原始 system prompt |

---

## 关联技能

- `arena`：Arena 评估数据拉取与失败排查
- `eval-get-result`：获取评估实例指标结果
- `eval-query`：查询 Exercise / Collection 配置
- `job-operations`：查看 Merlin Job 日志与配置
- `merlin-job-debug`：任务失败排查
- `tools-bytedcli merlin`：bytedcli merlin 兜底工具
