---
name: bytedance-cronjob
description: "Operate ByteDance cronjob via bytedcli: list/get jobs, list records, deploy jobs, rerun jobs, debug jobs, find logs. Use when tasks mention cronjob, 定时任务, 任务调度, 发布, 升级版本, 补数, 重跑, 调试, 查日志. 重要：当涉及查找日志时，必须优先确认任务所在的控制面 (Site) 环境，请务必参考 references/workflow-find-logs.md 流程。"
---

# Cronjob (bytedcli)

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

- 列出 Cronjob 任务列表 (my 或 all)
- 获取 Cronjob 任务详情
- 列出 Cronjob 执行记录 (支持按 cluster-id / job-id / psm 筛选)
- 获取 Cronjob 实例详情
- 发布 Cronjob 任务到指定集群，升级 SCM 版本
- 查询 Cronjob 发布单状态
- 查找 Cronjob 任务日志 (含跨区域/I18n)
  - **重要**：必须优先执行 `references/workflow-find-logs.md` 中定义的站点确认流程。
- 重跑 Cronjob 任务 (支持依赖)
- 启动 Cronjob 调试容器 (空跑 sleep)
- 列出支持的挂载目录和可用区域

## 核心流程：查找日志 (Find Logs)

当用户请求查找 Cronjob 日志时，**严禁**直接在默认环境搜索。请务必遵循以下步骤：

1.  **阅读工作流**：立即阅读 `references/workflow-find-logs.md`。
2.  **确认站点 (Site)**：根据用户提供的关键词（如 I18n, TikTok, SG, US, Prod 等）确定 `--site` 参数。若不确定，**必须询问用户**。
3.  **获取 Cluster ID**：使用 `cronjob list-zones` 或 `cronjob list-jobs` 获取数字 ID，不能直接使用名称（如 `sg1`）。
4.  **提取链接**：通过 `cronjob get-instance` 获取 `argos_stdout_view_log` 等链接。

## 前置条件

- 按通用调用方式执行命令（含内网 registry）：`references/invocation.md`
- 需要鉴权的命令先登录：`bytedcli auth login`

## 常用命令

```bash
# 列出 Cronjob 任务
# 支持按关键词搜索，--type 默认为 my
bytedcli cronjob list-jobs \
  --type "my" --search "keyword" --page 1 --size 20

# 获取 Cronjob 任务详情
bytedcli cronjob get-job \
  --job-id 12345

# 列出 Cronjob 执行记录
# 必须指定 --cluster-id 或 --job-id 或 --psm 其中之一
# 支持按 --status (Running/Succeeded/Failed) 和 --task-type (cron/rerun/debug) 筛选
bytedcli cronjob list-job-records \
  --cluster-id 12345 --status "Succeeded" --page 1 --size 20

# 获取 Cronjob 实例详情
# instance-name 可以是完整的 task_name 或 rerun/debug 的前缀
bytedcli cronjob get-instance \
  --cluster-id 12345 --instance-name "job-instance-name"

# 重跑 Cronjob 任务
# --command 为必填，--run-deps 可选（是否跑依赖）
bytedcli cronjob rerun-job \
  --cluster-id 12345 --command "echo hello" --run-deps

# 发布 Cronjob 任务
# deploy-job 是一个命令组，实际执行发布使用 deploy 子命令
bytedcli cronjob deploy-job \
  deploy --job-id 12345 --psm "cronjob.demo" --cluster-ids "85243,85244" \
  --scm-repo-id 507579 --scm-repo-name "demo/repo" --scm-repo-version "1.0.0.1"

# 查询发布单状态
# 发布单状态查询使用 deploy-job status 子命令
bytedcli cronjob deploy-job status \
  --ticket-id 30253713

# 启动 Cronjob 调试容器
# 默认执行 sleep 命令，--duration-sec 控制存活时长（默认 300s）
bytedcli cronjob debug-job \
  --cluster-id 12345 --duration-sec 300 --run-deps

# 列出支持的挂载目录
bytedcli cronjob list-mounts

# 列出可用区域和集群
bytedcli cronjob list-zones
```

## Notes

- 需要结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json cronjob list-jobs`）
- `rerun-job` 支持 `--extra-args` 传递额外参数
- `deploy-job` 通过 Cronjob `upgrade` 接口提交发布单，需要显式传 `job-id`、`psm`、`cluster-ids` 和目标 SCM 版本信息；CLI 会读取任务当前 SCM 仓库列表，替换目标仓库后提交完整 `scm_repos`
- `deploy-job` 是一级命令组，常用子命令是 `deploy` 和 `status`

## References

- `references/invocation.md`
- `references/workflow-find-logs.md`
