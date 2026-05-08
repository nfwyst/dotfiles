---
name: merlin-companion-eval
description: 管理和监控 merlin, seed 训练任务的伴生评估（Companion Evaluation）与序列任务（Sequence Job）：查询/更新/回溯伴生任务、管理序列任务、复制伴生任务、从零创建伴生评估（绑定 Checkpoint）、获取评估结果并创建 Insight 分析。当用户说"伴生评估/companion job/查看伴生任务/创建伴生评估/复制伴生任务/Checkpoint 评估结果/Auto Evaluation/sequence job/序列任务/回溯评估"时使用。支持用户直接提供 HDFS 路径，自动计算 dir_hash / ckpt_hash。
---

# 伴生评估与序列任务管理

管理 Merlin 训练任务的伴生评估（Companion Evaluation）与序列任务（Sequence Job），覆盖查询、更新、复制、回溯、从零创建、监控结果与 Insight 分析。

## 业务概念全景

### 实体层级

```
HdfsCkptDir  ── 标识: ckpt_set_id = {"dir_hash": "abc..."}
├── HdfsTrainCkpt [1..N]  ── 标识: ckpt_id = {"dir_hash": "abc...", "ckpt_hash": "def..."}
│   └── SequenceJob [0..N]  ── 针对单个 ckpt 执行的编排任务
│       ├── SequenceJobNode [1..N]  (按依赖顺序执行)
│       │   └── 产物: HdfsTransformCkpt (可传递给下游 Node)
│       └── status: RUNNING / DONE / FAILED
└── CompanionJob [0..N]  ── 绑定: ckpt_set_id = {"dir_hash": "abc..."}
    ├── 自动触发: 新 ckpt 产出时按 step/token 间隔、正则条件自动触发
    ├── 手动回溯 (Backfill): 对已有 ckpt 手动触发
    └── 触发产生 → SequenceJob 实例
```

### 关键概念

| 概念 | 说明 |
|------|------|
| CompanionJob | SequenceJob 的运行配置 + 触发配置，绑定到某个 checkpoint 目录 |
| SequenceJob | 针对单个 checkpoint 执行的编排任务实例，由多个 Node 组成 |
| SequenceJobNode | SequenceJob 内的执行节点（模型转换、评估等），有依赖顺序 |
| 自动触发 | CompanionJob 监听目录，新 checkpoint 产出时自动触发 SequenceJob |
| 手动回溯 (Backfill) | 对已有 checkpoint 手动触发 SequenceJob 执行 |

### Node 执行链示例

SequenceJob 内 Node 按依赖顺序执行，上游产物自动传递给下游：

| 顺序 | Node 类型 | 输入 | 产物 |
|------|----------|------|------|
| 1 | Safetensors 模型转换 | HdfsTrainCkpt (原始) | HdfsTransformCkpt (safetensors) |
| 2 | Quantize 量化 | 上游 Node 1 产物 | HdfsTransformCkpt (量化格式) |
| 3 | 自动评估 | 上游 Node 2 产物 | 评估结果 |

### ID 体系与路径自动转换

`dir_hash` 和 `ckpt_hash` 由 HDFS 路径的 SHA-256 计算得到（计算前需归一化 NonTT 前缀）。

**AI 必须遵循以下规则**：

1. **用户提供 `hdfs://` 路径时** → 自动调用 `merlin-checkpoints` Skill 的 hash 脚本计算（目录路径和 ckpt 路径计算方式相同，输出的 hash 按语境用作 `dir_hash` 或 `ckpt_hash`）：
   ```bash
   python3 skills/bytedance-merlin/references/merlin-checkpoints/scripts/hash_ckpt_path.py "hdfs://..."
   ```
2. **用户直接提供 64 位 hex 字符串时** → 直接作为 hash 使用
3. **用户提供模糊信息时** → 先通过 `list_hdfs_ckpt_dirs`（merlin-checkpoints Skill）搜索

## 前置条件

- `bytedcli merlin` 可用
- 知道训练任务的 `job_run_id` 或伴生任务的 sid

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

如果出现认证错误（401/403），运行 `bytedcli auth login`。

---

## 1. 查询伴生评估任务

获取训练任务关联的伴生评估列表：

```bash
bytedcli merlin eval get-companion-job --job-run-id '<job_run_id>'
```

返回包含：`step`（Checkpoint 步数）、`evaluation_sid`、`collection_sids`、`status`（DONE/FAILED 等）。

如果需要通过条件（如关键字、类型、模式、创建者等）筛选伴生评估任务列表，可以使用：

```bash
bytedcli merlin eval list-companion-job --keyword my-eval --type '["AUTO_EVALUATION"]'
```

按 checkpoint 目录筛选（需要 dir_hash）：

```bash
# 用户提供 HDFS 路径时，先计算 hash
python3 skills/bytedance-merlin/references/merlin-checkpoints/scripts/hash_ckpt_path.py "hdfs://..."
# → hash = "586f5e..."（用作 dir_hash）

bytedcli merlin eval list-companion-job --ckpt-set-id '{"dir_hash":"586f5e..."}'
```

---

## 2. 更新伴生评估任务

更新伴生任务的名称、描述、类型、模式或配置：

```bash
bytedcli merlin eval update-companion-job --sid '<companion_sid>' --name updated-name --enable
```

---

## 3. 复制伴生评估任务

基于现有伴生任务复制到新 HDFS 目录：

```bash
bytedcli merlin eval create-companion-job-fork --companion-job-id sid123 --target-dir-path hdfs://path/to/dir --fork-name my-new-eval
```

**注意**：目标 HDFS 目录必须存在；不指定新名称可能因名称重复而失败。

---

## 4. 回溯执行伴生评估

基于伴生配置在指定 checkpoint 上回溯执行。有两种方式：

### 方式 A：按 ckpt_id 回溯（需要 dir_hash + ckpt_hash）

适用于用户提供完整 checkpoint 路径的场景：

```bash
# Step 1: 分别计算目录和 ckpt 路径的 hash
python3 skills/bytedance-merlin/references/merlin-checkpoints/scripts/hash_ckpt_path.py "hdfs://example-cluster/home/sample/models/my-llm" "hdfs://example-cluster/home/sample/models/my-llm/step-1000"
# → 第一个 hash 用作 dir_hash = "586f5e..."，第二个用作 ckpt_hash = "e78e7c..."

# Step 2: 执行回溯
bytedcli merlin eval backfill-companion-job --sid '<companion_sid>' --ckpt-ids '[{"dir_hash":"586f5e...","ckpt_hash":"e78e7c..."}]'
```

### 方式 B：按 path + step 回溯（更简单）

适用于用户只说"帮我回溯 hdfs://xxx step 1000"的场景：

```bash
bytedcli merlin eval backfill-companion-job-by-step --companion-job-id '<companion_sid>' --path hdfs://example-cluster/home/sample/models/my-llm --checkpoint-step 1000
```

### AI 引导逻辑

| 用户输入 | 推荐方式 |
|---------|---------|
| "回溯评估 hdfs://xxx step 1000" | 方式 B（`backfill_companion_job_by_step`）— 直接用 path + step |
| "回溯 hdfs://xxx/step-1000" | 方式 A（`backfill_companion_job`）— 计算 dir_hash + ckpt_hash |
| 提供 ckpt_ids JSON | 直接调用方式 A |

---

## 5. 从零创建伴生评估

当基于基线任务派生新训练任务后，需要为新任务创建伴生评估。典型流程：

1. 通过 `bytedcli merlin eval get-companion-job` 获取基线训练任务的伴生评估配置
2. 通过 `bytedcli merlin checkpoint get` 并设置 `wait_until_creation=true`，等待新训练任务的 HDFS checkpoint 卡片创建完成
3. 从返回结果提取 `result.hdfs_ckpt_dir.path`（对应 `output_dir_path`）和 `result.hdfs_ckpt_dir.hash`（对应 `target_dir_hash`）
4. 创建伴生评估：

```bash
bytedcli merlin eval create-companion-job \
  --job-run-id <new_job_run_id> \
  --output-dir-path <hdfs_ckpt_dir_path> \
  --target-dir-hash <hdfs_ckpt_dir_hash> \
  --config '<基线伴生任务的其他配置 JSON>'
```

创建前建议调用 `merlin-job-resource` 技能选择合适的集群与队列。

---

## 6. 序列任务（Sequence Job）管理

序列任务用于编排多步评估流程，支持创建、查询、停止和重试。

### 序列任务类型与节点结构

不同 `type` 的序列任务内部节点（Node）结构不同，通常由前置的模型转换节点和最后一个核心功能节点组成：

| 任务类型 (`type`) | 内部节点结构说明 |
|-------------------|----------------|
| `AUTO_EVALUATION` | 前置 n 个节点是模型转换，最后一个节点是**评估**，名字通常叫 `Evaluation`。 |
| `ADHOC_SERVING` | 前置 n 个节点是模型转换，最后一个节点是**临时部署 (Serving)**，名字以 `Serving` 或 `Server` 结尾。 |
| `OFFLINE_INFER` | 前置 n 个节点是模型转换，最后一个节点是**离线推理**，名字叫 `Data Processing`。 |
| `MODEL_TRANSFORMATION` | 所有节点都是**模型转换**。 |

### 常用命令

```bash
# 列出序列任务
bytedcli merlin eval list-sequence-job --limit 20

# 按条件筛选
bytedcli merlin eval list-sequence-job --type AUTO_EVALUATION --status '["RUNNING"]' --creator user

# 按 Checkpoint 目录筛选（需要 dir_hash）
bytedcli merlin eval list-sequence-job --ckpt-set-id '{"dir_hash":"<dir_hash>"}'

# 按 Checkpoint ID 筛选（需要 dir_hash + ckpt_hash）
bytedcli merlin eval list-sequence-job --ckpt-id '{"dir_hash":"<dir_hash>","ckpt_hash":"<ckpt_hash>"}'

# 获取序列任务详情
bytedcli merlin eval get-sequence-job --sid '<sequence_sid>'

# 创建序列任务
bytedcli merlin eval create-sequence-job \
  --name my-sequence \
  --type BACKFILL \
  --config '{"nodes":{},"deps":[]}'

# 停止序列任务
bytedcli merlin eval stop-sequence-job --sid '<sequence_sid>'

# 重试序列任务
bytedcli merlin eval retry-sequence-job --sid '<sequence_sid>'
```

---

## 7. 监控评估结果与 Insight 分析

获取评估完成的 Checkpoint 结果并创建 Insight 进行深度分析。

### 获取评估结果

```bash
bytedcli merlin eval get-companion-job --job-run-id '<job_run_id>'
```

从返回中筛选 `status=DONE` 的条目，提取 `evaluation_sid` 和 `collection_sids`。

### 创建 Insight

```bash
bytedcli merlin merlin-insight create --name 'Job_<job_id>_Step<step>_Analysis' --evaluation-sids '{"cn":["<evaluation_sid>"]}' --collection-sids '[{"collection_sid":"<col_sid>","collection_version_sid":"<ver_sid>"}]'
```

region 选择：国内用 `cn`，海外用 `sg`。

### 调用 merlin-insight 技能分析

创建 Insight 后，调用 `merlin-insight` 技能进行能力分析和显著性对比。

---

## 端到端工作流示例

### 场景：从 HDFS 路径到触发回溯评估

```bash
# 1. 用户提供目录路径，计算 hash（用作 dir_hash）
python3 skills/bytedance-merlin/references/merlin-checkpoints/scripts/hash_ckpt_path.py "hdfs://example-source/home/sample/models/my-llm"
# → hash = "586f5edeab15..."

# 2. 查询该目录绑定的 CompanionJob
bytedcli merlin eval list-companion-job --ckpt-set-id '{"dir_hash":"586f5edeab15..."}'
# → 获取 companion_sid

# 3. 列出可回溯的 checkpoint
bytedcli merlin checkpoint list-train-ckpts-for-backfill --dir-hash 586f5edeab15...

# 4a. 按 ckpt_id 回溯（需计算 ckpt 路径的 hash 作为 ckpt_hash）
python3 skills/bytedance-merlin/references/merlin-checkpoints/scripts/hash_ckpt_path.py "hdfs://example-cluster/home/sample/models/my-llm/step-1000"
# → hash = "e78e7c3e62ba..."（用作 ckpt_hash）
bytedcli merlin eval backfill-companion-job --sid '<companion_sid>' --ckpt-ids '[{"dir_hash":"586f5edeab15...","ckpt_hash":"e78e7c3e62ba..."}]'

# 4b. 或者按 path + step 回溯（更简单）
bytedcli merlin eval backfill-companion-job-by-step --companion-job-id '<companion_sid>' --path hdfs://example-source/home/sample/models/my-llm --checkpoint-step 1000
```

---

## 注意事项

- `evaluation_sid` 和 `collection_sids` 来自伴生评估列表的返回结果
- 创建 Insight 时 region key 需匹配环境（cn 或 sg）
- 同一 step 的评估已处理过则跳过（去重）
- 必须先 `merlin-insight create` 获取 `merlin-insight_sid`，再调用 `merlin-insight` 技能分析
- 需要 dir_hash / ckpt_hash 时，优先从 HDFS 路径通过 `hash_ckpt_path.py` 自动计算

---

## 关联技能

- `merlin-insight`：Insight 深度分析（能力分析、显著性、案例查询）
- `merlin-job-launch`：创建并启动训练任务
- `merlin-job-resource`：选择合适的资源配置
- `merlin-checkpoints`：查询 Checkpoint 卡片与目录信息（包含 hash 计算脚本）
