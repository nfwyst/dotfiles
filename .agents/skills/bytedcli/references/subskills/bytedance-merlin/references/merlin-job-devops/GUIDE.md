---
name: merlin-job-devops
description: 对运行中的 merlin, seed 任务执行运维操作：查看日志与训练进度、查询时间线与 Pod 退出信息、在 Pod 内执行命令、获取 Grafana 监控链接、停止任务、审计热更新历史。当用户说"查看任务日志/任务进度/查询时间线/Pod 退出码/在任务里执行命令/获取 Grafana/停止任务/终止任务/任务运维/热更新审计/hot update"时使用。
---

# Job 运行态操作

对运行中的 Merlin 任务执行运维操作。根据用户需求阅读对应的 reference 文件获取详细步骤。

## 前置条件

- `bytedcli merlin` 可用
- 知道 `job_run_id`（部分操作还需 `trial_id`）

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

如果出现认证错误（401/403），运行 `bytedcli auth login`。

## 操作分类

| 操作 | 详细文档 | 关键命令 |
|------|----------|----------|
| 查看日志、分析训练进度 | `references/logs.md` | `job list-trial-logs` + 压缩脚本 |
| 查询时间线、Pod 退出信息 | `references/timeline.md` | `job get-timeline` + `job list-trial-exit-info` |
| 在 Pod 内执行命令 | `references/execute.md` | `job execute-script` |
| 获取 Grafana 监控链接 | `references/grafana.md` | `job get-grafana` |
| 停止任务 | `references/stop.md` | `job stop-run` |
| 热更新历史审计 | `references/hot-update-audit.md` | `job get-timeline` + `checkpoint get-step` |

## 脚本

| 脚本 | 路径 | 作用 |
|------|------|------|
| 日志下载与压缩 | `scripts/download_and_compress_logs.py` | 下载日志 + 压缩片段 + 增量模式 |
| 批量日志抓取 | `scripts/batch-get-jobs.sh` | 兜底快速抓取最后 N 行日志 |

---

## 关联技能

- `merlin-job-debug`：任务失败与 hang 诊断
- `merlin-job-launch`：创建并启动任务
