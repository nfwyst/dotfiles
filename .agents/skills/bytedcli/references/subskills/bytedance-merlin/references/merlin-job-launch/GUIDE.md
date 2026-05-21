---
name: merlin-job-launch
description: 创建并启动 merlin, seed 训练任务。支持按模板启动、从零创建、fork 复制已有任务、重试失败任务。当用户说"创建任务/发起训练/启动任务/从零开始/fork 任务/复制任务/提交新任务/重试任务/fork一个/fork job"时使用。也适用于用户提供了 job_def_name、镜像地址、入口脚本、资源配置等信息想启动训练的场景。
---

# 任务创建与启动

根据用户的输入选择对应命令：

| 场景 | 命令 | launch_mode |
|------|------|------|
| 有任务模板名称 | `bytedcli merlin job create-run` | `job_def` |
| 从零开始（代码/镜像/资源） | `bytedcli merlin job create-run` | `from_scratch` |
| fork/复制已有任务 | `bytedcli merlin job fork-run` | — |
| 重试失败任务 | `bytedcli merlin job retry-run` | — |

使用 `--schema` 查看每个命令的完整参数定义；按 schema 字段传 `--kebab-case` option，object/array 字段传 JSON-valued option。

## 前置条件

确保 `bytedcli merlin` 可用，认证错误时运行 `bytedcli auth login`。

## 通用流程

1. **确认关键配置**：namespace（产品线）、镜像、入口命令、资源配置、代码仓库等，缺失时向用户询问
2. **获取资源配置**：调用 `merlin-job-resource` 技能获取可用的资源组、集群、队列信息，填入 resource_config
3. **创建任务**：调用对应命令
4. **监控状态**：`bytedcli merlin job get-run`，设置 `wait_until_running: true`
5. **失败处理**：调用 `merlin-job-debug` 分析根因

## 关键字段说明

- **namespace**：Merlin 平台产品线命名空间。个人使用填 `/user/{邮箱前缀}`（如 `/user/zhangsan`）；非个人项目填 `/topic/{项目ID}`，可通过 Merlin 平台「管理中心-产品线管理」查看有权限的产品线 namespace。不传时后端默认 `/user/{邮箱前缀}`
- **resource_config**：资源配置中的 group_ids、cluster_id、queue_name、gpuv 等值通过 `merlin-job-resource` 技能（`list_job_my_resource` 工具）查询获取；清单化步骤见 `references/resource-select.md`（自 seed `job-launch` 合并）
- **launch_mode=from_scratch**：需要镜像、入口命令、资源配置。详细步骤见 `references/launch-from-scratch.md`
- **fork-run**：基于已有任务 fork 创建新任务，可通过 job_run_params 覆盖部分配置。详细步骤见 `references/fork-and-submit.md`

## 任务链接格式

- cn：`https://ml.bytedance.net/development/instance/jobs/{job_run_id}`
- cn-seed：`https://seed.bytedance.net/development/instance/jobs/{job_run_id}`
- i18n-tt：`https://ml.tiktok-row.net/development/instance/jobs/{job_run_id}`
- i18n-bd：`https://ml-i18nbd.byteintl.net/development/instance/jobs/{job_run_id}`

---

## 关联技能

- `merlin-job-resource`：资源配额查询与选择
- `merlin-job-debug`：任务失败、hang、Robust 多 run 与在线排查
- `merlin-companion-eval`：创建伴生评估
