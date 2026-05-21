---
name: merlin-data-card
description: 查询和管理 Seed DataCard（Iceberg 表）。支持列表查询、获取基本信息、获取详情、创建/更新 DataCard、上传任务状态查询、Namespace 浏览、分支管理、快照查看、数据预览、Tag 管理、血缘关系、字段信息等。当用户说"查看 DataCard/Iceberg 表/数据表列表/数据预览/快照/Tag/血缘/字段""创建 DataCard/导入数据表""更新 DataCard 信息""查询上传任务状态"时使用。注意：数据上传请使用 merlin-eval-data-upload 技能。
---

# DataCard 查询与管理

查询和管理 Seed 平台上的 DataCard（Iceberg 表），覆盖列表查询、基本信息、详情查询、创建、更新、上传任务状态轮询、Namespace 浏览、数据预览、快照管理、Tag 管理、血缘追踪等。

## 前置条件

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

如果出现认证错误（401/403），运行 `bytedcli auth login`。

---

## 1. 查询 DataCard 列表

```bash
bytedcli merlin data list --catalog seed --page 1 --page-size 12

# 按 region 筛选
bytedcli merlin data list --catalog seed --region cn --page 1 --page-size 12
```

---

## 2. 获取 DataCard 基本信息（轻量）

仅返回 IcebergTable 元数据，不含列/分区等详情。适合快速确认表是否存在、获取基础属性。

```bash
bytedcli merlin data get --data-card-name seed.database_name.table_name
```

---

## 3. 查询 DataCard 详情

返回完整详情（含列、分区、统计等），比 `data get` 更重。

```bash
bytedcli merlin data get-detail --data-card-name seed.database_name.table_name
```

---

## 4. 创建 DataCard（导入/注册任务）

创建 DataCard 并发起 Iceberg 表导入任务。支持 HDFS、飞书表格、Hive 等多种数据源。

```bash
# 从 HDFS 导入
bytedcli merlin data create --catalog seed --database-name my_namespace --table-name my_table --datacard-dataset-type eval --file-config '{"file_config_type":"hdfs","hdfs_path":"hdfs://path/to/data","hdfs_file_format":"parquet"}'

# 从飞书表格导入
bytedcli merlin data create --catalog seed --database-name my_namespace --table-name my_table --datacard-dataset-type eval --file-config '{"file_config_type":"larksheet","sheet_url":"https://bytedance.larkoffice.com/sheets/xxx"}'
```

创建成功后返回 `job_sid`，可用于轮询任务状态（见下方第 5 节）。

---

## 5. 查询上传任务状态

提交创建任务后，使用 `list-upload-jobs` 按 sid 轮询任务状态，直到 `status` 变为 `Succeeded` 或 `Failed`。

```bash
# 按 sid 查询特定任务
bytedcli merlin data list-upload-jobs --sid '<job_sid>'

# 按状态过滤
bytedcli merlin data list-upload-jobs --status Running

# 按表名模糊搜索
bytedcli merlin data list-upload-jobs --table-name my_table
```

支持的参数：`sid`、`status`、`creator`、`database_name`、`table_name`、`branch`、`dataset_type_filter`、`offset`、`limit`。

典型轮询流程：
1. 调用 `data create` 获得 `job_sid`
2. 循环调用 `bytedcli merlin data list-upload-jobs --sid <job_sid>`
3. 检查 `jobs[0].status`，直到不再是 `Running`/`Pending`
4. `Succeeded` 表示成功，`Failed` 表示失败（可查看 `stderr_link` 排错）

---

## 6. 更新 DataCard 信息

更新 DataCard 的描述、标签、数据集类型、白名单等。

```bash
bytedcli merlin data update --data-card-name seed.database_name.table_name --datacard-description '新的描述' --datacard-dataset-type train --datacard-dataset-modal TEXT --like
```

---

## 7. 浏览 Namespace 列表

列出可用的 DataCard Namespace。

```bash
bytedcli merlin data list-namespaces

# 按 catalog 和类型过滤
bytedcli merlin data list-namespaces --catalog seed --datacard-dataset-type eval --page 1 --page-size 20
```

支持的参数：`catalog`、`namespace`、`page_num`、`page_size`、`datacard_dataset_type`、`need_permission`。

---

## 8. 浏览分支

列出 DataCard 下的所有分支。

```bash
bytedcli merlin data list-branches --namespace '<namespace>' --table-name '<table_name>'
```

---

## 9. 查看快照

```bash
# 列出快照
bytedcli merlin data list-snapshot --full-table-name seed.database_name.table_name

# 获取指定快照详情
bytedcli merlin data get-snapshot --namespace '<namespace>' --table-name '<table_name>' --snapshot-id '<snapshot_id>'

# 获取快照血缘关系
bytedcli merlin data get-snapshot-lineage --namespace '<namespace>' --table-name '<table_name>' --snapshot-id '<snapshot_id>'
```

---

## 10. 数据预览

预览 DataCard 的数据内容，可指定快照版本。

```bash
bytedcli merlin data get-data-preview --namespace '<namespace>' --table-name '<table_name>' --limit 10

# 指定快照版本预览
bytedcli merlin data get-data-preview --namespace '<namespace>' --table-name '<table_name>' --snapshot-id '<snapshot_id>' --limit 5
```

---

## 11. 查看字段（列）信息

```bash
bytedcli merlin data list-columns --full-table-name seed.database_name.table_name
```

---

## 12. Tag 管理

```bash
# 列出 Tag
bytedcli merlin data list-tags --namespace '<namespace>' --table-name '<table_name>'

# 创建 Tag（将快照标记为标签）
bytedcli merlin data create-tag --namespace '<namespace>' --table-name '<table_name>' --tag-name v1.0 --snapshot-id '<snapshot_id>'

# 删除 Tag
bytedcli merlin data delete-tag --namespace '<namespace>' --table-name '<table_name>' --tag-name v1.0
```

---

## 常见问题

| 现象 | 原因和处理 |
|------|-----------|
| `bytedcli: command not found` | 先安装 bytedcli |
| 401 / 403 认证错误 | 运行 `bytedcli auth login` 重新登录 |
| 找不到表 | 检查 `full_table_name` 格式是否正确（`catalog.namespace.table`） |

## 关联技能

- `merlin-eval-data-upload`：上传数据到 DataCard
- `merlin-recipe-eval-exercise-setup`：从 DataCard 创建 Exercise
