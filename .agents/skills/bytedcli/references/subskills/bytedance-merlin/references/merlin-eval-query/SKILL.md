---
name: merlin-eval-query
description: 查询 merlin, seed 评估 Exercise、Collection 的配置和版本信息，以及 DataCard 评估数据与字段统计。当用户说"查询 exercise/查看 exercise 版本/exercise 信息/查询 collection/collection 版本/collection 结构/查询 DataCard/数据集统计/字段统计/评估数据查询"时使用。
---

# 评估查询

查询 Merlin 评估 Exercise、Collection 的详细信息，以及 DataCard 评估数据与字段统计。

## 前置条件

- 知道要查询的 `exercise_sid`、`collection_sid` 或 DataCard 名称
- `bytedcli merlin` 可用

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

如果出现认证错误（401/403），运行 `bytedcli auth login`。

---

## Exercise 查询

### 获取 Exercise 信息

```bash
bytedcli merlin exercise get --exercise-sid exe_abc123
```

### 获取 Exercise Version 信息

```bash
bytedcli merlin exercise get-version --exercise-version-sid ver_xyz789
```

---

## Collection 查询

### 获取 Collection 信息

```bash
bytedcli merlin collection get --collection-sid col_abc123
```

### 获取 Collection Version 信息

```bash
bytedcli merlin collection get-version --collection-sid col_abc123 --collection-version-sid ver_xyz789
```

输出包含 sid、name、tree 结构等。

---

## DataCard 查询

查询评估原始数据和字段统计。DataCard 名称格式：`{catalog}.{database}.{table}`。

### 查询评估原始数据

```bash
bytedcli merlin data get-eval-data --data-card-name catalog.db.table --snapshot-id 123456
```

### 查询字段统计信息

```bash
bytedcli merlin data get-field-stat --data-card-name catalog.db.table --snapshot-id 123456
```

输出包含字段 schema、记录数、文件大小等元数据。

**注意**：`snapshot_id` 不能为空。

---

## 关联技能

- `merlin-recipe-eval-exercise-setup`：创建 Exercise
- `merlin-recipe-eval-collection`：创建 Collection
- `merlin-recipe-eval-run`：运行评估
- `merlin-eval-data-upload`：上传评估数据集到 DataCard
