---
name: merlin-job-template
description: 查询和创建 merlin, seed 任务模板（JobDef）及其版本。当用户说"查询任务模板/查看模板版本/对比模板版本/创建任务模板/新建模板版本"时使用。
---

# 任务模板管理

查询和创建 Merlin 任务模板（JobDef）及其版本，用于定义可复用的任务配置。

## 前置条件

- `bytedcli merlin` 可用
- 查询：知道任务模板名称
- 创建：拥有创建权限，已准备入口脚本、镜像、资源配置等

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

如果出现认证错误（401/403），运行 `bytedcli auth login`。

---

## 查询模板版本

```bash
bytedcli merlin job get-def-versions --job-def-name my-template
```

查询指定版本：

```bash
bytedcli merlin job get-def-versions --job-def-name my-template --versions '[1,2,3]'
```

输出每个版本的详细信息：
- `version`：版本号
- `name`：版本名称
- `creationTime`：创建时间
- `comments`：版本说明
- `createdBy`：创建者
- `jobDefVersion`：版本配置详情（`entrypointFullScript`、`imageMeta`、`gitRepo`、`resource`）

返回结果按版本号排序。

---

## 创建任务模板

```bash
bytedcli merlin job create-def --name my-template --entrypoint-full-script 'python train.py' --resource-config '{"group_id":123,"cluster_id":456}'
```

### 创建模板新版本

```bash
bytedcli merlin job create-def-version --job-def-name my-template --entrypoint-full-script 'python train_v2.py' --resource-config '{"group_id":123,"cluster_id":456}' --comment '优化训练脚本'
```

**注意**：
- 模板名称需唯一
- 资源配置（group_id、cluster_id）是必需的
- 默认镜像为 `hub.byted.org/base/lab.debian.bullseye:11.11`
