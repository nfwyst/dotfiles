# 芒果任务命令

当需要查询、创建芒果任务或触发任务流水线时读取本文件。

查询任务时所有参数都不是必传；创建任务和触发流水线时再显式传 `--space-id` 和 `--module`。

## 查询任务

```bash
bytedcli mango task list --env ppe_demo
bytedcli mango task list --space-id 6 --module demo_module --name demo-task
bytedcli mango task list --space-id 6 --module demo_module --env ppe_demo
bytedcli --json mango task list --space-id 6 --module demo_module --env ppe_demo --name demo-task
```

参数：

| CLI 参数            | 说明                        | 是否必传 |
| ------------------- | --------------------------- | -------- |
| `--space-id <id>`   | 芒果空间 ID，用作过滤条件。 | 否。     |
| `--module <module>` | 应用模块，用作过滤条件。    | 否。     |
| `--name <name>`     | 任务名称关键词，模糊查询。  | 否。     |
| `--env <env>`       | BOE 或 PPE 泳道环境。       | 否。     |

文本输出默认展示任务 ID、任务名称、泳道环境和创建人。需要完整数据时使用 `--json`。

## 创建任务

创建任务前先通过 `app list` 确认模块：

```bash
bytedcli mango app list --space-id 6
```

命令：

```bash
bytedcli mango task create --space-id 6 --module demo_module --name demo-task --boe boe_demo --ppe ppe_demo
bytedcli mango task create --space-id 6 --module demo_module --name demo-task --boe boe_a,boe_b --ppe ppe_a --meego-id 1234567890
bytedcli --json mango task create --space-id 6 --module demo_module --name demo-task --boe boe_demo --ppe ppe_demo
```

参数：

| CLI 参数            | 说明                                   | 是否必传 |
| ------------------- | -------------------------------------- | -------- |
| `--space-id <id>`   | 芒果空间 ID。                          | 是。     |
| `--module <module>` | 应用模块。                             | 是。     |
| `--name <name>`     | 任务名称。                             | 是。     |
| `--boe <env>`       | BOE 泳道环境；支持重复传入或逗号分隔。 | 是。     |
| `--ppe <env>`       | PPE 泳道环境；支持重复传入或逗号分隔。 | 是。     |
| `--meego-id <id>`   | Meego 工作项 ID。                      | 否。     |

如果已存在同名任务，命令会提示已有任务的 ID 和名称，不会继续创建。

## 触发流水线

```bash
bytedcli mango task trigger-pipeline --space-id 6 --module demo_module --task-id <task-id>
bytedcli --json mango task trigger-pipeline --space-id 6 --module demo_module --task-id <task-id>
```

参数：

| CLI 参数            | 说明          | 是否必传 |
| ------------------- | ------------- | -------- |
| `--space-id <id>`   | 芒果空间 ID。 | 是。     |
| `--module <module>` | 应用模块。    | 是。     |
| `--task-id <id>`    | 任务 ID。     | 是。     |

适用于任务接口配置录入或修改后，需要让任务流水线重新运行生效的场景。
