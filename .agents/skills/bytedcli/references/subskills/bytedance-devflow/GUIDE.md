---
name: bytedance-devflow
description: "Manage Devflow R&D tasks via bytedcli: create publish tasks, query task detail and deploy status, search task lists, list work-item projects and work items."
---

# bytedcli Devflow

## 如何调用 bytedcli

先选择一种调用方式。下面所有示例默认直接写 `bytedcli`。

```bash
# 方式 1：直接用 npx 运行最新版
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]

# 方式 2：先全局安装，再直接调用 bytedcli
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli <command> [options]
```

- 使用 `npx` 时，把后文示例里的 `bytedcli` 替换成 `NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest`
- 已全局安装时，直接按后文示例执行 `bytedcli ...`

## When to use

- 创建 Devflow 发布任务（支持 TCE/TCC 发布项与 Meego 需求关联）
- 查看任务详情与部署状态
- 搜索和分页浏览任务列表
- 查询业务空间下的工作项项目列表
- 查询项目下的 Meego 需求（work item）列表
- 搜索可添加的服务/资源（按 PSM 关键词）
- 向已有任务追加服务

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- Devflow 命令使用 SSO JWT 认证（`X-Jwt-Token`），依赖 `bytedcli auth login` 建立的 SSO 会话

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## 概念说明

- **PSM**：字节内部服务唯一标识，三段点分式 `product.service.module`，例如 `example.product.service`。`--tce` 参数接收的值就是 PSM。
- **Lane（泳道）**：测试环境标识。`ppe_xxx` 为线上测试环境（Production Preview Environment），`boe_xxx` 为离线测试环境（Byte Offline Environment）。`task create --lane` 和 `task list` 返回的 `env_list[].lane` 都使用泳道名。

## 实体关系

Devflow 中的实体关系为：**Space（biz_id）→ Project → Work Item（需求）→ Task（研发任务）**。

## 推荐工作流

### 创建任务前：发现可关联的需求

在创建发布任务时，建议先通过以下方式查找可关联的 Meego 需求，而不是让用户手动填写 `--meego-link`。这样能保证关联的需求真实存在且信息准确。

**Step 1：查询项目列表**

```bash
bytedcli devflow project list --biz-id <biz_id>
```

从返回的 `meego_projects` 中选择目标项目的 `key`。

**Step 2：查询需求列表**

```bash
# 全量需求
bytedcli devflow work-item list --biz-id <biz_id> --project-key <key> --source 2

# 仅最近有估分的需求
bytedcli devflow work-item list --biz-id <biz_id> --project-key <key> --source 4

# 按名称搜索
bytedcli devflow work-item list --biz-id <biz_id> --project-key <key> --keyword "关键词"
```

从返回的 `items` 中选择目标需求，获取其 `link` 字段。

**Step 3：创建任务并关联需求**

```bash
bytedcli devflow task create \
  --title "..." \
  --biz-id <biz_id> \
  --source-branch <branch> \
  --lane <lane> \
  --dc <idc> \
  --tce <psm> \
  --meego-link "<从 Step 2 获取的 link>"
```

如果用户已经提供了 Meego URL 或明确的 work item ID，可以直接跳过 Step 1-2。

### 创建任务后：查看任务状态

```bash
# 查看基本信息
bytedcli devflow task get --id <task_id>

# 同时查看部署详情（PPE 环境、流水线链接、debug 状态等）
bytedcli devflow task get --id <task_id> --develop
```

## Quick start

### 创建发布任务

```bash
# 基础发布任务（TCE 服务）
bytedcli devflow task create \
  --title "demo release" \
  --biz-id 100 \
  --source-branch feat/demo \
  --lane demo_lane \
  --region cn \
  --dc dc-a \
  --tce example.psm

# 关联 Meego 需求（URL 模式，自动解析 projectKey 和 type）
bytedcli devflow task create \
  --title "demo release" \
  --biz-id 100 \
  --source-branch feat/demo \
  --lane demo_lane \
  --dc dc-a \
  --tce example.psm \
  --meego-link "https://meego.feishu.cn/project-demo/story/detail/123456"

# 关联 Meego 需求（ID 模式，需额外指定 type 和 project-key）
bytedcli devflow task create \
  --title "demo release" \
  --biz-id 100 \
  --source-branch feat/demo \
  --lane demo_lane \
  --dc dc-a \
  --tce example.psm \
  --meego-id 123456 \
  --meego-type story \
  --meego-project-key demo-project-key
```

### 查看任务详情

```bash
bytedcli devflow task get --id 12345
bytedcli devflow task get --id 12345 --develop
```

### 搜索任务列表

```bash
# 查我的任务
bytedcli devflow task list --biz-id 0 --creator demo-user

# 分页 + 关键词
bytedcli devflow task list --biz-id 0 --creator demo-user --page 1 --page-size 20 --keyword "demo"
```

### 查询项目与需求

```bash
# 查业务空间下的 Meego 项目
bytedcli devflow project list --biz-id 0

# 查项目下的需求列表
bytedcli devflow work-item list --biz-id 0 --project-key demo-project-key --source 2
```

### 搜索资源

```bash
# 按 PSM 关键词搜索可用服务/资源
bytedcli devflow resource search --biz-id 0 --keyword "example.psm"

# 分页
bytedcli devflow resource search --biz-id 0 --keyword "example.psm" --page 1 --page-size 10
```

### 向任务追加服务

```bash
# 向已有任务添加服务
bytedcli devflow task add-service \
  --psm example.psm \
  --name demo-org/demo-repo \
  --task-id 12345 \
  --source-branch feat/demo
```

## Notes

- 需要结构化输出加 `--json`
- `task create` 必填：`--title`、`--biz-id`、`--source-branch`、`--lane`、`--dc`（至少一个机房）和 `--tce` 或 `--tcc`（至少一个发布对象）
- `task create --target-branch` 默认为 `master`
- `task create --env` 默认为 `ppe`，`--region` 默认为 `cn`
- `task create --cluster` 可重复传多个或逗号分隔，不传时默认 `default`
- `task create --meego-link` 传入 Meego URL 时会自动解析 `projectKey`、`workItemType` 和 ID
- `task list` 必填 `--biz-id`；`--creator` 可重复传多个
- `task list --type-list` 默认为 `"8"`；`--source` 默认为 `0`
- `work-item list` 必填 `--biz-id` 和 `--project-key`
- `work-item list --source`：`2` = 全量 work item，`4` = 最近有估分的 work item
- `work-item list` 结果中 `id=0` 的项表示"无合适需求"
- `resource search` 必填 `--biz-id` 和 `--keyword`；`--type-list` 默认 `"2,3,4,5,17,24"`
- `resource search` 使用 v2 API（`devflowApiBaseUrl`），其他查询接口使用 v1 API
- `task add-service` 必填 `--psm`、`--name`、`--task-id`、`--source-branch`
- `task add-service --provider` 默认 `TCE`，`--type` 默认 `2`
- `task create` 成功后（非 JSON 模式）会输出任务链接 `https://devflow.bytedance.net/space/{id}/task/{id}/develop`
- 所有命令均使用 SSO JWT 认证，无需额外配置 token
- 如果在创建任务时用户未提供 `--meego-link` 或 `--meego-id`，主动向用户提议：先用 `project list` 找到项目，再用 `work-item list` 找到需求，然后把需求的 `link` 传给 `--meego-link`

## Migration

`devflow publish` 已改为 `devflow task create`。旧命令 `devflow publish` 仍可使用（hidden alias），但推荐迁移到新命令。

## References

- `references/devflow.md`
