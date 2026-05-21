---
name: merlin-eval-data-upload
description: 上传评估数据集到 Seed 平台。当需要将 HDFS 上的数据文件（parquet/json/csv）或 LarkSheet 导入为评估集 DataCard 时使用。触发词：上传评估数据、upload eval data、data upload、评估集上传、DataCard 上传、parquet 上传、数据集导入、HDFS 数据上传、导入评估数据、注册评估集、导入数据到 Seed、新建 DataCard、创建数据表、LarkSheet 导入、tag 列上传、evaluation tag column。即使用户没有明确说"上传"，只要涉及将数据文件或表格注册到 Seed 平台作为评估集或 DataCard，都应使用本 skill。本地文件仍需先通过 `hdfs dfs -put` 上传到 HDFS；如果用户要把某一列作为 evaluation tag column 上传，应使用 `file_config.tag_columns`。
---

# 评估数据集上传

通过 `bytedcli merlin data upload` 将 HDFS 数据文件或 LarkSheet 上传为 Seed 平台的评估集 DataCard。

## 前置条件

- 数据源已准备好：
  - HDFS 场景：数据文件已在 HDFS 上（本地文件需先通过 `hdfs dfs -put` 上传）
  - LarkSheet 场景：需要有效的飞书表格链接；如果要指定 evaluation tag column，需明确哪些列要写入 `__internal_tags__`
- `bytedcli merlin` 已安装并完成认证：

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

如果遇到 401/403 认证错误，运行 `bytedcli auth login` 重新登录。

## 上传命令

```bash
bytedcli merlin data upload --name '<可选任务名>' --description '<可选 DataCard 描述>' --database-name '<库名>' --table-name '<表名>' --file-config '{"file_config_type":"hdfs","hdfs_path":"hdfs://example-cluster/home/sample/<你的路径>","hdfs_file_format":"parquet"}' --write-mode create --datacard-dataset-type eval
```

参数较多时也可以写到文件里：

```bash
bytedcli merlin data upload --schema  # then pass schema-derived options
```

### 必须由用户提供的参数（禁止猜测）

| 参数 | 说明 | 为什么不能猜 |
|------|------|------------|
| `database_name` | Seed 上的库名 | 每个团队/项目的库名不同 |
| `table_name` | Seed 上的表名 | 表名由用户决定，写错会创建错误的表 |
| `file_config.hdfs_path` | HDFS 数据路径 | 路径因用户和场景而异 |
| `write_mode` | 当用户要用 `overwrite` 时必须确认 | `overwrite` 会**清空已有数据**再写入，属于破坏性操作 |
| `file_config.tag_columns` | 当用户要把某几列上传成 evaluation tag column 时，必须由用户明确给出列名 | 会直接影响样本级 `__internal_tags__`，列选错会导致评估标签错误 |

### 关键参数

| 参数 | 说明 | 可选值 | 默认值 |
|------|------|--------|--------|
| `datacard_dataset_type` | 数据集类型。设为 `"eval"` 后 DataCard 才会出现在 Seed 评估界面，也才能关联到 Exercise | `train`, `eval`, `normal` | - |
| `write_mode` | 写入模式。首次创建表用 `create`，后续更新用 `append` 或 `overwrite` | `create`, `overwrite`, `append` | `append` |
| `file_config.file_config_type` | 数据源类型 | `hdfs`, `larksheet` | `hdfs` |
| `file_config.sheet_url` | 飞书表格链接；`larksheet` 场景必填 | string | - |
| `file_config.tag_columns` | 指定哪些列写入 evaluation tag column，后端会映射到 `evaluation_tag_columns` / `__internal_tags__` | array[string] | - |
| `file_config.unmarshal_json_columns` | 与 evaluation tag column 场景配合使用，不按 JSON 解析的列 | array[string] | - |
| `hdfs_file_format` | 文件格式 | `parquet`, `json`, `csv`, `eval_image_tar`, `vlm_video`, `multi_modal` | `parquet` |
| `datacard_dataset_modal` | 数据模态 | `TEXT`, `VISION`, `VIDEO`, `SPEECH`, `MULTIMODAL` | - |
| `datacard_dataset_stage` | 数据阶段标签 | 例如 `pretrain`, `sft`, `rl`, `rm` | - |
| `datacard_dataset_language` | 数据语种标签 | 业务自定义字符串 | - |
| `name` | 上传任务名 | string | - |
| `description` | DataCard 描述 | string | - |
| `catalog` | 数据目录 | - | `seed` |
| `target_branch` | Iceberg 表分支 | - | `main` |
| `wait` | 设为 `true` 则阻塞等待任务完成 | `true`, `false` | `false` |
| `envs` | 注入到上传任务中的环境变量 | object | - |
| `resource` | 自定义资源队列配置（见下方说明）。不传则使用公共资源池 | object | 公共资源池 |

### Evaluation Tag Column

如果用户说“把某一列作为 tag 列上传”“指定 evaluation tag column”“导入后希望样本带 `__internal_tags__`”，用的是：

```json
"file_config": {
  "file_config_type": "larksheet",
  "sheet_url": "https://bytedance.larkoffice.com/sheets/...",
  "tag_columns": ["tags"]
}
```

底层 Titan 会把 `file_config.tag_columns` 转成任务参数 `evaluation_tag_columns`，再写入评估样本的 `__internal_tags__`。

注意事项：

- `tag_columns` 是否生效，取决于源数据里是否真的存在对应列，以及后端导入链路是否消费 `evaluation_tag_columns`
- 每个列名都必须由用户明确提供，不能猜
- 列名不能包含英文逗号 `,`
- 如果还需要控制哪些列不要按 JSON 解析，可同时传 `file_config.unmarshal_json_columns`

### 自定义资源队列（resource）

> **⚠️ 使用自定义资源需要用户确认**：`resource` 涉及团队资源配额，agent 不得自行填写。必须向用户确认具体的资源组（`group_id`）和集群（`cluster_id`）后再传入。如果用户没有主动指定资源，一律使用公共资源池（不传 `resource`）。

默认情况下上传任务使用公共资源池，无需传 `resource`。当用户明确要求使用自定义资源时，结构如下：

```json
"resource": {
  "group_id": 12345,
  "cluster_id": 67890,
  "quota_pool": "default"
}
```

| 字段 | 说明 | 必填 |
|------|------|------|
| `group_id` | 资源组 ID | 是 |
| `cluster_id` | 集群 ID | 是 |
| `quota_pool` | 资源池类型（`default`、`hybrid`、`hybrid_share`、`third_party`、`third_party_hw`、`third_party_hw_npu`、`third_party_aws`、`third_party_gcp`、`third_party_azure`、`third_party_oci`、`third_party_azure2`） | 否 |
| `group_name` | 资源组名称（仅标识用途） | 否 |
| `cluster_name` | 集群名称（仅标识用途） | 否 |
| `queue_priority` | 队列优先级 | 否 |
| `using_public_queue` | 是否使用公共队列 | 否 |

用户可以在 Merlin 平台的资源管理页面查看自己有权限的资源组和集群 ID。

查看完整参数 schema：

```bash
bytedcli merlin data upload --schema
```

## 等待任务完成

**方式一**：在上传参数中加 `"wait": true`，命令会阻塞直到任务结束。

**方式二**：手动轮询任务状态：

```bash
# 查询单个上传任务状态
bytedcli merlin data get-job --sid '<上传返回的 sid>'

# 列出所有上传任务
bytedcli merlin data list-jobs
```

状态流转：`LAUNCHING` → `STARTED` → `RUNNING` → `DONE`（成功）或 `FAILED`（失败）。

上传任务通常耗时 5-20 分钟，视数据量而定。使用 `wait: true` 时应预留足够等待时间，不要因为等待较长而判断为异常。

## 完整示例

将 HDFS 上的 parquet 文件作为评估集上传：

```bash
# 1. 上传评估数据集（阻塞等待完成）
bytedcli merlin data upload --name mmlu-dev-import --description 'MMLU dev set for evaluation' --database-name '<your_database>' --table-name '<your_table>' --file-config '{"file_config_type":"hdfs","hdfs_path":"hdfs://example-cluster/home/sample/<your_path>","hdfs_file_format":"parquet"}' --write-mode create --datacard-dataset-type eval --wait

# 2. 查看 DataCard
# https://seed.bytedance.net/seed/data/warehouse/seed.<database_name>.<table_name>
```

将 LarkSheet 中某一列作为 evaluation tag column 上传：

```bash
bytedcli merlin data upload --database-name '<your_database>' --table-name '<your_table>' --file-config '{"file_config_type":"larksheet","sheet_url":"https://bytedance.larkoffice.com/sheets/<sheet_id>","tag_columns":["tags"],"unmarshal_json_columns":["tags"]}' --write-mode create --datacard-dataset-type eval --wait
```

## 解读上传结果

上传完成后（`wait: true` 或手动查询），返回的 JSON 中关键字段：

| 字段 | 说明 |
|------|------|
| `sid` | 任务 ID，用于后续查询 |
| `status` | 最终状态，`DONE` 表示成功 |
| `full_table_name` | 完整表名（如 `seed.test.mmlu_dev`），用于拼接 DataCard URL |
| `merlin_job_id_url` | Merlin 任务详情页链接，上传失败时可直接分享给用户排查 |

向用户展示结果时，重点呈现：DataCard URL 和任务状态。失败时附上 `merlin_job_id_url`。

## DataCard 地址

上传完成后，DataCard 详情页地址为：

```
https://seed.bytedance.net/seed/data/warehouse/seed.<database_name>.<table_name>
```

## 常见问题

| 现象 | 原因和处理 |
|------|-----------|
| 任务状态 `FAILED` | 查看任务详情 `bytedcli merlin data get-job --sid ...`，检查错误信息；常见原因：HDFS 路径不存在、文件格式不匹配 |
| `write_mode: create` 报错表已存在 | 该表已被创建过，改用 `overwrite`（清空重写）或 `append`（追加数据） |
| `tag_columns` 没有生效 | 先确认源数据里确实存在该列；再检查上传任务参数里是否带上了 `evaluation_tag_columns` |
| `tag_columns` 报参数错误 | 检查列名是否为空、是否包含英文逗号 `,`，并确认列名与源数据字段名完全一致 |
| 401 / 403 认证错误 | 运行 `bytedcli auth login` 重新登录 |
| `AccessResourceDenied` | 没有目标库/表的写权限，联系管理员授权 |

更多排查参考：[导入失败错误排查手册](https://bytedance.larkoffice.com/wiki/JexdwRKaliJByFk4HyecleHUnBe)

## 相关 Skills

- **下一步**: `merlin-recipe-eval-exercise-setup` — 从 DataCard 创建 Exercise
