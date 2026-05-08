---
name: bytedance-merlin
description: |
  Merlin 平台 All-in-One 操作指南。使用 bytedcli merlin 原生命令完成：Job 管理、Devbox 开发机、Tracking 实验跟踪、Arena 评估、Insight 分析、Checkpoint/Model/Data 卡片管理等。

  触发词：Merlin、Seed、ml.bytedance.net、seed.bytedance.net、ml.tiktok-row.net、训练任务、开发机、评估、Arena、Tracking、Checkpoint、模型卡片、数据卡片、GPU、401/403 认证失败。
---

# Merlin 平台 All-in-One Guide

Merlin 是字节跳动的机器学习训练与评估平台。本 skill 整合了所有 Merlin 相关操作的子技能。

## 快速导航

| 场景                            | 推荐子技能                                                                                   |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| 认证失败 / 401/403              | [bytedcli Merlin 兜底](references/merlin-cli/SKILL.md)                                      |
| 创建/启动训练任务               | [merlin-job-launch](references/merlin-job-launch/SKILL.md)                                   |
| 任务失败排查                    | [merlin-job-debug](references/merlin-job-debug/SKILL.md)                                     |
| 运行态运维（日志/Grafana/停止） | [merlin-job-devops](references/merlin-job-devops/SKILL.md)                                   |
| 资源配额查询                    | [merlin-job-resource](references/merlin-job-resource/SKILL.md)                               |
| 任务模板管理                    | [merlin-job-template](references/merlin-job-template/SKILL.md)                               |
| 开发机管理                      | [merlin-devbox](references/merlin-devbox/SKILL.md)                                           |
| 开发机故障排查                  | [merlin-devbox-troubleshoot](references/merlin-devbox-troubleshoot/SKILL.md)                 |
| 启动 GPU Worker                 | [merlin-devbox-worker](references/merlin-devbox-worker/SKILL.md)                             |
| Arena 评估数据拉取              | [merlin-arena](references/merlin-arena/SKILL.md)                                             |
| Arena 失败分析                  | [merlin-arena-task-failure-analysis](references/merlin-arena-task-failure-analysis/SKILL.md) |
| Arena 慢任务分析                | [merlin-arena-task-slow-analysis](references/merlin-arena-task-slow-analysis/SKILL.md)       |
| Arena 得分对比                  | [merlin-arena-diff](references/merlin-arena-diff/SKILL.md)                                   |
| Arena Trajectory 拉取           | [merlin-arena-trajectory](references/merlin-arena-trajectory/SKILL.md)                       |
| 评估结果导出                    | [merlin-eval-result-export](references/merlin-eval-result-export/SKILL.md)                   |
| 获取评估指标                    | [merlin-eval-get-result](references/merlin-eval-get-result/SKILL.md)                         |
| 查询 Exercise/Collection        | [merlin-eval-query](references/merlin-eval-query/SKILL.md)                                   |
| 上传评估数据                    | [merlin-eval-data-upload](references/merlin-eval-data-upload/SKILL.md)                       |
| 创建 Exercise                   | [merlin-recipe-eval-exercise-setup](references/merlin-recipe-eval-exercise-setup/SKILL.md)   |
| 创建 Collection                 | [merlin-recipe-eval-collection](references/merlin-recipe-eval-collection/SKILL.md)           |
| 运行评估                        | [merlin-recipe-eval-run](references/merlin-recipe-eval-run/SKILL.md)                         |
| Evals-to-Exercise 验证          | [merlin-recipe-e2e-eval-verify](references/merlin-recipe-e2e-eval-verify/SKILL.md)           |
| 伴生评估管理                    | [merlin-companion-eval](references/merlin-companion-eval/SKILL.md)                           |
| Tracking 实验分析               | [merlin-tracking-experiment](references/merlin-tracking-experiment/SKILL.md)                 |
| Insight 分析                    | [merlin-insight](references/merlin-insight/SKILL.md)                                         |
| Checkpoint 管理                 | [merlin-checkpoints](references/merlin-checkpoints/SKILL.md)                                 |
| 模型卡片                        | [merlin-model-card](references/merlin-model-card/SKILL.md)                                   |
| 数据卡片                        | [merlin-data-card](references/merlin-data-card/SKILL.md)                                     |
| Profiling 资产                  | [merlin-profiling](references/merlin-profiling/SKILL.md)                                     |
| 线上服务查询                    | [merlin-service](references/merlin-service/SKILL.md)                                         |
| HDFS 跨洋传输                   | [merlin-hdfs-migration](references/merlin-hdfs-migration/SKILL.md)                           |
| Grafana 监控                    | [merlin-grafana-observation](references/merlin-grafana-observation/SKILL.md)                 |
| 知识问答                        | [merlin-knowledge-qa](references/merlin-knowledge-qa/SKILL.md)                               |

---

## 核心工具：bytedcli merlin

bytedcli merlin 是仓库内原生命令入口，复用 bytedcli 认证并通过 schema-derived options 调用 Merlin MCP。

### 安装

```bash
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

### 认证与站点选择

```bash
bytedcli auth login

# 运行 Merlin 命令时用全局 site/vregion 选择控制面
bytedcli --site cn merlin job get-run --job-run-id <job-run-id>
bytedcli --site cn --vregion seed merlin job get-run --job-run-id <job-run-id>
bytedcli --site i18n-tt merlin devbox list
bytedcli --site i18n-bd merlin devbox list
```

### 控制面

| bytedcli 选择 | Merlin 控制面 | 域名                     |
| --------- | --------- | ------------------------ |
| `--site cn` | `cn`      | `ml.bytedance.net`       |
| `--site cn --vregion seed` | `cn-seed` | `seed.bytedance.net`     |
| `--site i18n-tt` | `i18n-tt` | `ml.tiktok-row.net`      |
| `--site i18n-bd` | `i18n-bd` | `ml-i18nbd.byteintl.net` |

### 常用命令

```bash
# 发现工具
bytedcli merlin --help

# 查看 Schema
bytedcli merlin <group> <command> --schema

# option-first 调用
bytedcli merlin <group> <command> [schema-derived options]

# 预览请求
bytedcli merlin <group> <command> --dry-run [schema-derived options]
```

### Generated command 快速索引

| Group | 常用命令 |
| --- | --- |
| `arena` | `get-evaluation`, `list-case`, `create-evaluation`, `create-eval-result-export-job` |
| `checkpoint` | `list-ckpt-dirs`, `list-ckpts`, `get-dir`, `get-step` |
| `collection` | `list`, `get`, `create`, `create-version` |
| `data` | `list`, `get`, `get-data-preview`, `get-field-stat` |
| `devbox` | `list`, `get`, `create`, `execute-script`, `get-logs` |
| `eval` | `list-sequence-job`, `get-sequence-job`, `enable-companion-job`, `disable-companion-job` |
| `exercise` | `list`, `get`, `create`, `create-version` |
| `insight` | `get`, `create`, `get-ability`, `get-significance` |
| `job` | `get-run`, `create-run`, `fork-run`, `get-timeline`, `get-grafana` |
| `model` | `list`, `get`, `get-v2`, `list-v2`, `create-idc-sync-job` |
| `pipeline` | `list-def`, `get-def`, `list-run`, `get-run`, `retry-run` |
| `profiling` | `list`, `get`, `get-tos-link` |
| `service` | `list`, `get`, `get-seed-template`, `create-instant-deployment` |
| `tracking` | `get-project`, `list-projects`, `get-run`, `list-runs`, `get-timeseries` |
| `trigger` | `list-def`, `get-def`, `list-run`, `reset-status` |

MCP-backed generated commands currently support `--site cn`, `--site cn --vregion seed`, `--site i18n-tt`, `--site i18n-bd`, and `--site i18n-bd --vregion seed`. Unsupported Merlin sites fail fast instead of falling back to CN.

For generated commands, `--arg key=value` parses `true`, `false`, `null`, numbers, quoted JSON strings, objects, and arrays before sending raw MCP arguments.

详细用法见 [bytedcli Merlin 兜底](references/merlin-cli/SKILL.md)。

---

## 子技能分类索引

### Job 任务管理

| 子技能                                                         | 说明                                   |
| -------------------------------------------------------------- | -------------------------------------- |
| [merlin-job-launch](references/merlin-job-launch/SKILL.md)     | 创建并启动训练任务（按模板/fork/重试） |
| [merlin-job-debug](references/merlin-job-debug/SKILL.md)       | 任务失败排查与诊断                     |
| [merlin-job-devops](references/merlin-job-devops/SKILL.md)     | 运行态运维（日志/Grafana/停止/热更新） |
| [merlin-job-resource](references/merlin-job-resource/SKILL.md) | 资源配额查询与队列选择                 |
| [merlin-job-template](references/merlin-job-template/SKILL.md) | 任务模板（JobDef）管理                 |

### Devbox 开发机

| 子技能                                                                       | 说明                              |
| ---------------------------------------------------------------------------- | --------------------------------- |
| [merlin-devbox](references/merlin-devbox/SKILL.md)                           | 开发机管理（查询/启动/停止/执行） |
| [merlin-devbox-troubleshoot](references/merlin-devbox-troubleshoot/SKILL.md) | 开发机故障排查（SSH/启动/连接）   |
| [merlin-devbox-worker](references/merlin-devbox-worker/SKILL.md)             | GPU/CPU Worker 节点管理           |

### Arena 评估

| 子技能                                                                                       | 说明                                |
| -------------------------------------------------------------------------------------------- | ----------------------------------- |
| [merlin-arena](references/merlin-arena/SKILL.md)                                             | 评估数据拉取（概览/case 明细）      |
| [merlin-arena-task-failure-analysis](references/merlin-arena-task-failure-analysis/SKILL.md) | 评估任务失败分析                    |
| [merlin-arena-task-slow-analysis](references/merlin-arena-task-slow-analysis/SKILL.md)       | 评估任务慢任务分析                  |
| [merlin-arena-diff](references/merlin-arena-diff/SKILL.md)                                   | 两个评估任务得分对比                |
| [merlin-arena-trajectory](references/merlin-arena-trajectory/SKILL.md)                       | Trajectory（Trace）数据拉取与可视化 |
| [merlin-eval-result-export](references/merlin-eval-result-export/SKILL.md)                   | 评估明细后台导出任务                |

### Exercise/Collection 评估

| 子技能                                                                                     | 说明                                |
| ------------------------------------------------------------------------------------------ | ----------------------------------- |
| [merlin-eval-query](references/merlin-eval-query/SKILL.md)                                 | 查询 Exercise/Collection 配置与版本 |
| [merlin-eval-get-result](references/merlin-eval-get-result/SKILL.md)                       | 获取评估实例指标结果                |
| [merlin-eval-data-upload](references/merlin-eval-data-upload/SKILL.md)                     | 上传评估数据集到 Seed 平台          |
| [merlin-recipe-eval-exercise-setup](references/merlin-recipe-eval-exercise-setup/SKILL.md) | 从 DataCard 创建 Exercise           |
| [merlin-recipe-eval-collection](references/merlin-recipe-eval-collection/SKILL.md)         | 从 Exercise Version 创建 Collection |
| [merlin-recipe-eval-run](references/merlin-recipe-eval-run/SKILL.md)                       | 运行 Exercise 评估                  |
| [merlin-recipe-e2e-eval-verify](references/merlin-recipe-e2e-eval-verify/SKILL.md)         | Evals 代码到 Exercise 端到端验证    |
| [merlin-companion-eval](references/merlin-companion-eval/SKILL.md)                         | 伴生评估与序列任务管理              |

### Tracking & Insight

| 子技能                                                                       | 说明                   |
| ---------------------------------------------------------------------------- | ---------------------- |
| [merlin-tracking-experiment](references/merlin-tracking-experiment/SKILL.md) | 实验跟踪与指标分析     |
| [merlin-insight](references/merlin-insight/SKILL.md)                         | Insight 分析与案例查询 |

### 资源管理

| 子技能                                                       | 说明                                |
| ------------------------------------------------------------ | ----------------------------------- |
| [merlin-checkpoints](references/merlin-checkpoints/SKILL.md) | Checkpoint 目录与条目管理           |
| [merlin-model-card](references/merlin-model-card/SKILL.md)   | 模型卡片（Model Card）管理          |
| [merlin-data-card](references/merlin-data-card/SKILL.md)     | 数据卡片（DataCard/Iceberg 表）管理 |
| [merlin-profiling](references/merlin-profiling/SKILL.md)     | Profiling 资产管理                  |
| [merlin-service](references/merlin-service/SKILL.md)         | 线上服务（Bernard）查询             |

### 其他

| 子技能                                                                       | 说明                    |
| ---------------------------------------------------------------------------- | ----------------------- |
| [bytedcli Merlin 兜底](references/merlin-cli/SKILL.md)                       | 命令发现、schema、认证排障 |
| [merlin-hdfs-migration](references/merlin-hdfs-migration/SKILL.md)           | HDFS 跨洋传输与数据搬迁 |
| [merlin-grafana-observation](references/merlin-grafana-observation/SKILL.md) | Grafana 监控观测        |
| [merlin-knowledge-qa](references/merlin-knowledge-qa/SKILL.md)               | 平台知识问答            |

---

## 使用建议

1. **认证问题**：遇到 401/403 时，先运行 `bytedcli auth login`
2. **任务创建**：使用 `merlin-job-launch` 按模板或 fork 创建
3. **任务失败**：使用 `merlin-job-debug` 进行诊断
4. **评估相关**：根据具体场景选择对应的 Arena/Exercise 子技能
5. **兜底工具**：当其他子技能不适用时，使用 `bytedcli merlin` 直接调用 API
