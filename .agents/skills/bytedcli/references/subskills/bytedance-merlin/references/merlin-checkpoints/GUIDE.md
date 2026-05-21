---
name: merlin-checkpoints
description: 查询和管理 HDFS Checkpoint 目录、目录组与 checkpoint 条目。当需要获取训练 Checkpoint 详情、枚举 Titan 上的 checkpoint 目录/目录组、刷新目录或查询权限时使用。支持用户直接提供 HDFS 路径，自动计算 dir_hash / ckpt_hash。
---

# Checkpoint 查询与管理

## 适用场景

- 获取训练 Checkpoint 卡片详情（MCP：`get_hdfs_checkpoint_card`）
- 按 job_run_id 查询某步的 checkpoint 信息（MCP：`get_step_ckpt_by_job_run_id`）
- 按条件分页查询 HDFS checkpoint 目录（MCP：`list_hdfs_ckpt_dirs`）
- 分页查询 checkpoint 目录组（MCP：`list_hdfs_ckpt_dir_groups`）
- 获取单个 checkpoint 目录详情（MCP：`get_hdfs_ckpt_dir`）
- 查询单个训练 checkpoint 关联的 checkpoint（MCP：`list_hdfs_ckpts`）
- 查询单个 checkpoint 目录下的训练 checkpoint （MCP：`list_hdfs_train_ckpts`）
- 刷新 checkpoint 目录（MCP：`refresh_hdfs_ckpt_dir`）
- 查询用于回溯评估的训练 checkpoint（MCP：`list_hdfs_train_ckpts_for_backfill`）
- 查询 checkpoint 目录权限（MCP：`get_hdfs_ckpt_dir_permission`）
- 获取目录组信息（MCP：`get_hdfs_ckpt_dir_group`）

## 核心概念

### ID 体系

| 概念 | 标识符 | JSON 结构 | 说明 |
|------|--------|-----------|------|
| Checkpoint 目录 | `ckpt_set_id` | `{"dir_hash": "<64-char-hex>"}` | 训练 checkpoint 保存目录的唯一标识 |
| 单个 Checkpoint | `ckpt_id` | `{"dir_hash": "<64-char-hex>", "ckpt_hash": "<64-char-hex>"}` | 目录下单个 checkpoint 的唯一标识 |

- `dir_hash` = SHA-256(归一化后的**目录**路径)
- `ckpt_hash` = SHA-256(归一化后的 **checkpoint** 路径)
- `ckpt_id.dir_hash` 与 `ckpt_set_id.dir_hash` 是同一个值

### NonTT 路径归一化

为保证同一目录在不同 HDFS region 的 hash 一致，计算前需要将 NonTT 前缀转为 TT 前缀：

| NonTT 前缀 | TT 前缀（用于 hash 计算） |
|------------|-------------------------|
| `hdfs://example-source/home/sample/models` | `hdfs://example-target/home/sample/models` |

归一化**仅用于 hash 计算**，不改变实际 HDFS 路径。

## 路径自动转换（AI 指令）

本 Skill 提供 `hash_ckpt_path.py` 脚本，用于从 HDFS 路径计算 hash。`dir_hash` 和 `ckpt_hash` 的计算方式完全相同，区别仅在于输入的是目录路径还是 checkpoint 路径。

**AI 必须遵循以下规则**：

1. **用户提供 `hdfs://` 路径时** → 自动调用脚本计算 hash，再调用 MCP 工具：
   ```bash
   python3 skills/bytedance-merlin/references/merlin-checkpoints/scripts/hash_ckpt_path.py "hdfs://..."
   ```
2. **用户直接提供 64 位 hex 字符串时** → 直接作为 hash 使用
3. **用户提供模糊信息（名称/关键字）时** → 先通过 `list_hdfs_ckpt_dirs` 搜索，从返回结果获取 hash

**脚本使用示例**：

```bash
# 计算单个路径的 hash（目录路径 → 用作 dir_hash，ckpt 路径 → 用作 ckpt_hash）
python3 skills/bytedance-merlin/references/merlin-checkpoints/scripts/hash_ckpt_path.py "hdfs://example-source/home/sample/models/my-llm"
# 输出: {"results": [{"path": "...", "hash": "586f5e..."}]}

# 批量计算多个路径
python3 skills/bytedance-merlin/references/merlin-checkpoints/scripts/hash_ckpt_path.py "hdfs://dir-path" "hdfs://dir-path/step-1000"
```

## 前置条件

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

如果出现认证错误（401/403），运行 `bytedcli auth login`。

---

## 1. 查询 Checkpoint 卡片

获取 HDFS Checkpoint 卡片的详细信息，支持等待卡片创建完成。

```bash
bytedcli merlin checkpoint get --path hdfs://path/to/checkpoint

# 等待卡片创建完成（轮询最长 5 分钟）
bytedcli merlin checkpoint get --path hdfs://path/to/checkpoint --wait-until-creation
```

返回包含：`path`、`name`、`owners`、`stage`、`ckpt_count`、`min_step`/`max_step`、`jobs`、`source_sync`/`target_syncs` 等。

如果开启等待且返回 `should_retry: true`，说明卡片尚未创建完成，需要再次调用。

---

## 2. 按 Step 查询 Checkpoint

```bash
bytedcli merlin checkpoint get-step --job-run-id '<job_run_id>'
```

---

## 3. 查询 Checkpoint 目录列表

分页查询 HDFS checkpoint 目录，支持按名称、路径、owner、训练任务等筛选。

```bash
bytedcli merlin checkpoint list-ckpt-dirs --limit 20

# 按关键字和 owner 筛选
bytedcli merlin checkpoint list-ckpt-dirs --name-keyword llm --owner user.name --limit 10

# 按 Merlin 任务 ID 筛选
bytedcli merlin checkpoint list-ckpt-dirs --merlin-job-id '<job_id>' --limit 20
```

支持的筛选参数：`name_keyword`、`path_keyword`、`path_exact`、`owner`、`stage`、`modal`、`repo`、`merlin_job_id`、`arnold_trial_id`、`keyword`、`like`、`hdfs_ckpt_dir_group_sid`、`external_region`、`offset`、`limit`。

---

## 4. 查询 Checkpoint 目录组

```bash
bytedcli merlin checkpoint list-ckpt-dir-groups --limit 20

# 只看自己创建的
bytedcli merlin checkpoint list-ckpt-dir-groups --my-created
```

支持的筛选参数：`name_keyword`、`my_created`、`like`、`external_region`、`offset`、`limit`。

---

## 5. 获取目录详情与目录组信息

```bash
# 用户提供 HDFS 路径时，先计算 hash：
# python3 skills/bytedance-merlin/references/merlin-checkpoints/scripts/hash_ckpt_path.py "hdfs://..."
# 再用输出的 hash 作为 dir_hash 调用：
bytedcli merlin checkpoint get-dir --hash '<dir_hash>'

# 获取目录组信息
bytedcli merlin checkpoint get-dir-group --sid '<group_sid>'
```

---

## 6. 查询单个训练 checkpoint 关联的 checkpoint

```bash
# 需要 dir_hash 和 ckpt_hash，分别用目录路径和 ckpt 路径调用 hash_ckpt_path.py 计算
bytedcli merlin checkpoint list-ckpts --dir-hash '<dir_hash>' --train-ckpt-hash '<ckpt_hash>'
```

---

## 7. 查询单个 checkpoint 目录下的训练 checkpoint

查询 HDFS 训练 checkpoint 列表，支持按 step 范围、转换标签、任务 ID 等筛选。

```bash
bytedcli merlin checkpoint list-train-ckpts --dir-hash '<dir_hash>'

# 按 step 范围筛选
bytedcli merlin checkpoint list-train-ckpts --dir-hash '<dir_hash>' --step-from 1000 --step-to 5000
```

**从 HDFS 路径出发的完整示例**：

```bash
# Step 1: 计算 dir_hash
python3 skills/bytedance-merlin/references/merlin-checkpoints/scripts/hash_ckpt_path.py "hdfs://example-cluster/home/sample/models/my-llm"
# 假设输出 hash = "586f5e..."

# Step 2: 查询训练 checkpoint 列表
bytedcli merlin checkpoint list-train-ckpts --dir-hash 586f5e... --step-from 1000 --step-to 5000
```

---

## 8. 刷新 Checkpoint 目录

重新扫描 HDFS checkpoint 目录，更新目录下的 checkpoint 列表。

```bash
bytedcli merlin checkpoint refresh-dir --hdfs-ckpt-dir '<dir_path>'
```

---

## 9. 查询回溯评估用 Checkpoint

查询可用于回溯评估的训练 checkpoint 列表，支持按 step/token 范围和转换标签筛选。

```bash
bytedcli merlin checkpoint list-train-ckpts-for-backfill --dir-hash '<dir_hash>'

# 按 step 范围筛选
bytedcli merlin checkpoint list-train-ckpts-for-backfill --dir-hash '<dir_hash>' --step-from 1000 --step-to 5000
```

---

## 10. 查询目录权限

```bash
bytedcli merlin checkpoint get-dir-permission --hash '<dir_hash>'
```

---

## 端到端工作流示例

### 场景：从 HDFS 路径查询目录详情和训练 checkpoint

```bash
# 1. 用户提供 HDFS 目录路径，计算 hash（用作 dir_hash）
python3 skills/bytedance-merlin/references/merlin-checkpoints/scripts/hash_ckpt_path.py "hdfs://example-source/home/sample/models/my-llm"
# → hash = "586f5edeab15..."

# 2. 获取目录详情
bytedcli merlin checkpoint get-dir --hash 586f5edeab15...

# 3. 列出该目录下的训练 checkpoint
bytedcli merlin checkpoint list-train-ckpts --dir-hash 586f5edeab15...

# 4. 查询某个 ckpt 的关联 checkpoint（用 ckpt 路径计算 hash，作为 ckpt_hash）
python3 skills/bytedance-merlin/references/merlin-checkpoints/scripts/hash_ckpt_path.py "hdfs://example-cluster/home/sample/models/my-llm/step-1000"
# → hash = "e78e7c3e62ba..."（用作 ckpt_hash）

bytedcli merlin checkpoint list-ckpts --dir-hash 586f5edeab15... --train-ckpt-hash e78e7c3e62ba...
```

---

## 常见问题

| 现象 | 原因和处理 |
|------|-----------|
| `bytedcli: command not found` | 先安装 bytedcli |
| 401 / 403 认证错误 | 运行 `bytedcli auth login` 重新登录 |
| 等待超时 | 可加大等待时间或稍后重试 |
| 不知道 dir_hash | 提供 HDFS 路径，用 `hash_ckpt_path.py` 计算 |
| NonTT 路径与 TT 路径 hash 不同？ | 不会，脚本会自动归一化 NonTT 前缀，保证同一目录产出相同 hash |

## 关联技能

- `merlin-companion-eval`：伴生评估管理（依赖 checkpoint 信息）
- `merlin-model-card`：模型卡片管理
