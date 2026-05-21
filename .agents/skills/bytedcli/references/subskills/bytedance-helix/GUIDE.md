---
name: bytedance-helix
description: "Operate Helix model and AI task lifecycle commands via bytedcli. Use when tasks mention Helix, Video AIPF data preparation, Video AIPF training, Video AIPF evaluation, model training submission, Ray evaluation submission, BFF training records, BFF evaluation records, stopping model tasks, or checking model task status."
---

# bytedcli Helix

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

- 提交 Video AIPF 训练任务
- 查询 Video AIPF 训练任务状态、停止任务或查询训练记录
- 提交 Video AIPF Ray 评估任务
- 查询 Video AIPF 评估任务状态、停止任务或查询评估记录
- 提交 Video AIPF 数据准备任务，或按 task ID 查询数据准备结果
- 用户明确希望通过 bytedcli 调用 Helix 数据准备或 BFF 能力，而不是手写 curl / HTTP 请求

## Do not use

- 不要用它替代通用 Merlin job 排障；已有 Merlin job / trial / tracking 问题优先使用 `bytedance-merlin`
- 不要在用户只要求“看看命令”或“生成命令”时真实提交、停止线上任务
- 不要让用户传入 `jwt_token` / `jwtToken`；评估受控路径由 BFF 服务端处理执行凭证
- 不要把 API Key 写入文档、脚本或持久化配置

## 前置条件

- 训练和评估命令需要 Helix BFF API Key：
  - 环境变量：`BYTEDCLI_HELIX_API_KEY`
  - 或每次命令显式传入：`--api-key <key>`
- 数据准备命令不使用 Helix BFF API Key。
- 需要机器可读输出时，把 `--json` 放在 `helix` 前面
- 默认 endpoint 已内置；调试或非默认环境才使用 `--endpoint <url>` 或 `BYTEDCLI_HELIX_BASE_URL`

> 执行前缀见通用 bytedcli 说明；下面示例直接写 `bytedcli`。

## Command tree

```text
bytedcli helix
  train
    video-aipf
      submit
      status
      stop
      list
  eval
    video-aipf
      submit
      status
      stop
      list
  data
    video-aipf
      submit
      get
```

## Quick start

```bash
# 提交训练
bytedcli helix train video-aipf submit \
  --username demo-user \
  --input-table "example.catalog.sample_table?[date='20260512']" \
  --output-hdfs-dir hdfs://example/path/train-output \
  --caption demo-train-run

# 查询训练状态
bytedcli helix train video-aipf status \
  --username demo-user \
  --task-id demo-merlin-job-run-id

# 停止训练
bytedcli helix train video-aipf stop \
  --username demo-user \
  --task-id demo-merlin-job-run-id

# 查询训练记录
bytedcli helix train video-aipf list \
  --username demo-user \
  --requested-username demo-user \
  --page 1 \
  --page-size 20

# 提交评估
bytedcli helix eval video-aipf submit \
  --username demo-user \
  --table-identifier "example.catalog.sample_table?[date='20260512']" \
  --checkpoint-root-dir hdfs://example/path/checkpoints \
  --output-hdfs-dir hdfs://example/path/validate-runs \
  --run-name demo-eval-run \
  --limit 0 \
  --positive-vote-threshold 9

# 查询评估状态
bytedcli helix eval video-aipf status \
  --username demo-user \
  --task-id demo-ray-job-id

# 停止评估
bytedcli helix eval video-aipf stop \
  --username demo-user \
  --task-id demo-ray-job-id

# 查询评估记录
bytedcli helix eval video-aipf list \
  --username demo-user \
  --page 1 \
  --page-size 20

# 提交数据准备
bytedcli helix data video-aipf submit \
  --source "https://example.test/wiki/demo?sheet=SheetId" \
  --target-table sample_table \
  --username demo-user

# 查询数据准备结果
bytedcli helix data video-aipf get \
  --task-id demo-datasink-task-id
```

## Required inputs

训练提交必填：

- `--username`
- `--input-table`
- `--output-hdfs-dir`

训练状态 / 停止必填：

- `--username`
- `--task-id`

训练记录必填：

- `--username`

评估提交必填：

- `--username`
- `--table-identifier`
- `--checkpoint-root-dir`
- `--output-hdfs-dir`
- `--run-name`

评估状态 / 停止必填：

- `--username`
- `--task-id`

评估记录必填：

- `--username`

数据准备提交必填：

- `--source`
- `--target-table`
- `--username`

数据准备结果查询必填：

- `--task-id`

## Notes

- `--branch-name` 是高级可选参数；普通提交推荐不写，CLI 会使用当前验证过的 recipes ref。
- `--commit-sha` 是高级可选参数；普通提交推荐不写。只有需要临时固定其他 recipes 版本做复现或排查时再传，传入后会 pin 到该 commit，并设置 BFF payload 的 `git_repo.use_latest_commit = false`。
- `--input-table` 和 `--table-identifier` 可传完整 Magnus scan expression，例如 `example.catalog.sample_table?[date='20260512']`；在 shell 中要把完整值加双引号。
- 空筛选 `?[]` 或 `?[   ]` 会被 CLI 拒绝；不要把空 predicate 当作全量表语义。
- `eval video-aipf submit --limit <n>` 用于限制评估数据行数；`--limit 0` 表示全量评估，不传则由后端 recipe 按默认逻辑处理。
- `eval video-aipf submit --positive-vote-threshold <n>` 是可选参数，用于覆盖评估中“认为正例”的票数阈值；不传时使用 recipe 默认值。
- `train video-aipf list` 和 `eval video-aipf list` 支持 `--start`、`--end`、`--page`、`--page-size`，分页默认第 1 页、每页 20 条。
- `eval video-aipf submit --worker-count <n>` 可覆盖 Ray worker 数，不传时默认 1。
- `data video-aipf submit --source` 需要飞书表格 URL；表格列从左到右必须是 `item_id`、`neg_vote`、`pos_vote`、`label`、`label_cn`。
- `data video-aipf submit --target-table` 只填写表名后缀；CLI 会固定拼到 `content_moderation_omni.aipf.<suffix>`。
- 文本模式会输出摘要和表格；`--json` 模式返回结构化结果。
- `submit` 和 `stop` 都会影响线上任务，只在用户明确要求时执行。
