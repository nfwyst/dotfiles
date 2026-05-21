# Devflow 命令参考

## 命令树

```
devflow
  task
    create      创建发布任务（原 publish）
    get         查看任务详情（--develop 时含部署信息）
    list        分页搜索任务列表
    add-service 向已有任务追加服务
  project
    list        查询业务空间下的 Meego 项目
  work-item
    list        查询项目下的需求列表
  resource
    search      按 PSM 关键词搜索服务/资源
```

## 实体关系

Space (biz_id) → Project → Work Item (需求) → Task (研发任务)

## 命令详情

### devflow task create

创建 Devflow 发布任务，支持 TCE/TCC 发布项、多机房、多集群和 Meego 需求关联。

| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--title` | string | 是 | 任务标题 |
| `--biz-id` | number | 是 | 业务线 ID（即 space_id） |
| `--source-branch` | string | 是 | 源分支名 |
| `--lane` | string | 是 | 泳道名 |
| `--dc` | string[] | 是 | 部署 IDC，可重复或逗号分隔 |
| `--tce` | string[] | 二选一 | TCE 服务 PSM，可重复 |
| `--tcc` | string[] | 二选一 | TCC namespace，可重复 |
| `--target-branch` | string | 否 | 目标分支，默认 master |
| `--env` | string | 否 | 环境，默认 ppe |
| `--region` | string | 否 | 区域，默认 cn |
| `--cluster` | string[] | 否 | 集群，默认 default |
| `--idl-status` | string[] | 否 | IDL 状态，格式 `psm=value` |
| `--start-develop` | flag | 否 | 创建后自动启动开发任务 |
| `--meego-link` | string | 否 | Meego 需求 URL，自动解析 projectKey/type/ID |
| `--meego-id` | number | 否 | Meego 需求 ID |
| `--meego-title` | string | 否 | Meego 需求标题（默认取 --title） |
| `--meego-project-key` | string | 否 | Meego 项目 key |
| `--meego-project-name` | string | 否 | Meego 项目名 |
| `--meego-type` | string | 否 | Meego 需求类型，默认 story |
| `--meego-source` | number | 否 | Meego 来源，默认 2 |

### devflow task get

查看单个任务详情。

| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--id` | number | 是 | 任务 ID |
| `--develop` | flag | 否 | 同时获取部署详情（env_data_list） |

### devflow task list

分页搜索任务。

| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--biz-id` | number | 是 | 业务线 ID |
| `--creator` | string[] | 否 | 创建人过滤，可重复 |
| `--keyword` | string | 否 | 搜索关键词 |
| `--page` | number | 否 | 页码（1-based），默认 1 |
| `--page-size` | number | 否 | 每页条数，默认 20 |
| `--type-list` | string | 否 | 类型过滤，默认 8 |
| `--order-status` | number[] | 否 | 状态过滤，可重复 |
| `--source` | number | 否 | 来源，默认 0 |

### devflow project list

查询业务空间下的 Meego 项目列表。

| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--biz-id` | number | 是 | 业务线 ID |

### devflow work-item list

查询项目下的需求列表。

| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--biz-id` | number | 是 | 业务线 ID |
| `--project-key` | string | 是 | 项目 key（从 project list 获取） |
| `--project-name` | string | 否 | 项目名过滤，默认 ALL |
| `--keyword` | string | 否 | 需求名称关键词搜索 |
| `--source` | number | 否 | 2=全量 work item，4=最近有估分 |

### devflow task add-service

向已有任务追加服务。

| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--psm` | string | 是 | 服务 PSM |
| `--name` | string | 是 | 仓库名（如 `org/repo`） |
| `--task-id` | number | 是 | 任务 ID |
| `--source-branch` | string | 是 | 源分支 |
| `--provider` | string | 否 | 服务类型，默认 TCE |
| `--type` | number | 否 | 服务类型编号，默认 2 |
| `--region` | string | 否 | 区域，默认 cn |
| `--cluster` | string[] | 否 | 集群，默认 default |

### devflow resource search

按 PSM 关键词搜索可添加的服务/资源。

| 选项 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `--biz-id` | number | 是 | 业务线 ID |
| `--keyword` | string | 是 | 搜索关键词（PSM 名等） |
| `--type-list` | string | 否 | 类型过滤，默认 `"2,3,4,5,17,24"` |
| `--source` | number | 否 | 来源，默认 2 |
| `--task-id` | number | 否 | 关联任务 ID |
| `--page` | number | 否 | 页码，默认 1 |
| `--page-size` | number | 否 | 每页条数，默认 10 |
