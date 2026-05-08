---
name: merlin-insight
description: 创建、查询 merlin, seed Insight 分析，以及深入分析评估案例。当用户说"创建 Insight/查看 Insight/能力分析/显著性分析/查看评估案例/对比模型回答/分析具体 case"时使用。
---

# Insight 分析

创建 Insight、查询能力与显著性结果、深入分析评估案例。

## 前置条件

- `bytedcli merlin` 可用
- 已有评估结果（Arena 评估 sid）或 merlin-insight_sid

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

如果出现认证错误（401/403），运行 `bytedcli auth login`。

---

## 1. 创建 Insight

关联评估结果和 Collection 进行模型能力分析。

```bash
bytedcli merlin merlin-insight create --name my-merlin-insight --evaluation-sids '{"cn":["merlin-arena_sid_1","merlin-arena_sid_2"]}' --collection-sids '[{"collection_sid":"col1","collection_version_sid":"ver1"}]'
```

输出：
- `merlin-insight_sid`：创建的 Insight SID
- `is_created`：是否是新创建的（同名会返回已有的）
- `message`：操作结果信息

**注意**：Insight 名称需唯一，同名会返回已有的 Insight。

---

## 2. 查询 Insight

### 获取基础信息

```bash
bytedcli merlin merlin-insight get --merlin-insight-sid ins_abc123
```

输出包含 merlin-insight_uuid、name、tracking_runs、collection_info 等。

### 获取能力分析数据

```bash
bytedcli merlin merlin-insight get-ability --merlin-insight-sid ins_abc123 --collection-version-sid ver_xyz789
```

输出包含 CSV 下载链接的能力分析数据。

### 获取显著性结果

```bash
bytedcli merlin merlin-insight get-significance --merlin-insight-sid ins_abc123 --collection-version-sid ver_xyz789 --base-line-tracking-info '{"tracking_run_id":"run1"}'
```

---

## 3. 案例分析

深入分析具体的评估案例，查看模型在特定问题上的表现。

### 获取 Insight Run Case

```bash
bytedcli merlin merlin-insight get-run-case --dataset-name my-dataset --merlin-insight-sid ins_abc123 --question-id q123
```

### 列出数据集案例

```bash
bytedcli merlin merlin-insight list-dataset-cases --merlin-insight-sid ins_abc123 --dataset-name my-dataset --limit 10
```

### 搜索评估案例

```bash
bytedcli merlin merlin-insight search-case --merlin-arena-sid merlin-arena_xxx --evaluation-instance-sid eval_xxx --exercise-version-sid ver_xxx
```

输出包含 prompt、ground_truth、predict、metric 等。

---

## 关联技能

- `merlin-arena`：Arena 评估数据拉取与故障排查
- `merlin-eval-get-result`：获取评估实例指标结果
