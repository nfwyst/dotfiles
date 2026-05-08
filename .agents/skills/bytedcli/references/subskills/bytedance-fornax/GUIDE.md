---
name: bytedance-fornax
description: "Operate Fornax prompt workspaces, prompts, prompt publishing, and evaluation experiments via bytedcli. Use when tasks mention Fornax, prompt workspace, prompt draft, prompt key, prompt publish, prompt version, evaluation experiment, experiment results, aggregate evaluator results, or configuring Fornax experiment auth with JWT or AK/SK."
---

# bytedcli Fornax

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

- 列出当前账号可见的 Fornax workspace
- 在 workspace 下查询 prompt 列表、读取 prompt 详情或个人草稿
- 创建或更新 prompt 草稿，包括 system prompt、message list、model config、variables、metadata
- 提交 prompt 版本并发布到 BOE、PPE 或 online
- 创建 Fornax evaluation experiment
- 查询单个 experiment 详情、分页结果和 aggregate evaluator results
- 配置或检查 `fornax experiment` 所需的 JWT 或 AK/SK
- 通过 `trace-chain-diagnosis` skill 诊断 trace/span 链路（基于 logid 或 trace_id）

## Do not use

- 不要用它代替通用的 `bytedcli auth`；只有 `fornax experiment` 相关认证才用 `fornax auth`
- 不要把 `fornax auth config` 当成 Fornax 全量登录入口；prompt / workspace / publish 仍然复用 `bytedcli auth login`
- 不要用它处理与 Fornax 无关的模型对话、文档协作或实验平台；这些场景分别使用对应 domain skill

## 前置条件

- Prompt / Workspace / Publish 命令先完成 `bytedcli auth login`
- `fornax experiment` 需要额外凭据，二选一：
  - `bytedcli fornax auth config --access-key <ak> --secret-key <sk>`
  - `bytedcli fornax auth config --jwt-token <token>`
- 需要机器可读输出时，把 `--json` 放在 `fornax` 前面

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# Prompt / workspace
bytedcli fornax list-workspace
bytedcli --json fornax list-prompt --space-id <space-id>
bytedcli --json fornax get-prompt --space-id <space-id> --prompt-id <prompt-id>
bytedcli --json fornax get-prompt --space-id <space-id> --prompt-id <prompt-id> --personal-draft
bytedcli --json fornax create-prompt --space-id <space-id> --prompt-key team.demo.prompt --display-name "Demo Prompt" --system-prompt "You are a helpful assistant."
bytedcli --json fornax update-prompt --space-id <space-id> --prompt-id <prompt-id> --message-list-file ./messages.json
bytedcli --json fornax publish-prompt --space-id <space-id> --prompt-id <prompt-id> --target boe --submit-version 1.0.1 --feature demo
bytedcli --json fornax publish-prompt --space-id <space-id> --prompt-id <prompt-id> --target online --version 1.0.1 --comment "promote to prod"

# Experiment auth
bytedcli fornax auth config --access-key <ak> --secret-key <sk>
bytedcli fornax auth config --jwt-token <token>
bytedcli --json fornax auth status

# Experiment
bytedcli --json fornax experiment create --request-file ./experiment.json
bytedcli --json fornax experiment get --workspace-id <space-id> --experiment-id <experiment-id>
bytedcli --json fornax experiment results --workspace-id <space-id> --experiment-id <experiment-id> --page 1 --page-size 20
bytedcli --json fornax experiment aggr-results --workspace-id <space-id> --experiment-id <experiment-id>
```

## Workflow

### Prompt flow

1. 先执行 `bytedcli auth login`，确保默认 ByteCloud JWT 可用。
2. 用 `fornax list-workspace` 找到目标 `space-id`。
3. 用 `fornax list-prompt --space-id <id>` 查 prompt 列表。
4. 需要看当前个人草稿时，用 `fornax get-prompt --personal-draft`；需要看已提交版本时，用 `--version <version>`。
5. 创建草稿用 `create-prompt`；更新草稿用 `update-prompt`。
6. 需要提交新版本并发版时，用 `publish-prompt --submit-version ...`。
7. 需要发布已存在版本时，用 `publish-prompt --version ...`。

### Experiment flow

1. 先执行 `fornax auth status`，确认 experiment 凭据来源。
2. 未配置凭据时，先执行 `fornax auth config --access-key <ak> --secret-key <sk>` 或 `fornax auth config --jwt-token <token>`。
3. 新建 experiment 时，优先把完整请求体写入文件后使用 `fornax experiment create --request-file ./experiment.json`。
4. 需要确认 experiment 基本信息时，用 `fornax experiment get`。
5. 需要看分页结果时，用 `fornax experiment results --page <n> --page-size <n>`。
6. 需要看聚合评估结果时，用 `fornax experiment aggr-results`。

## Auth model

Fornax 当前分成两套认证链路：

1. Prompt / Workspace / Publish
   - 复用 `bytedcli auth login` 获取的 ByteCloud JWT
   - 不读取 `fornax auth config`

2. Experiment
   - 优先读取 CLI 显式传入的 `--jwt-token` 或 `--access-key --secret-key`
   - 其次读取环境变量：
     - `BYTEDCLI_FORNAX_EXPERIMENT_JWT`
     - `BYTEDCLI_FORNAX_EXPERIMENT_ACCESS_KEY_ID`
     - `BYTEDCLI_FORNAX_EXPERIMENT_SECRET_ACCESS_KEY`
     - 兼容 `FORNAX_SPACE_AK` / `FORNAX_SPACE_SK`
   - 最后读取本地 `fornax auth config`

## Notes

- `fornax auth config` 当前只作用于 `fornax experiment`，不会影响 Prompt / Workspace / Publish 命令
- `create-prompt` / `update-prompt` 支持通过 `--system-prompt-file`、`--message-list-file`、`--model-config-file`、`--variables-file`、`--metadata-file` 从文件读取内容
- `create-prompt` 的 `--prompt-type` 支持 `completion`、`chat`、`completion-v2`、`segment`
- `publish-prompt --submit-version` 会先提交当前草稿，再自动发起目标环境的发布任务
- `publish-prompt --version` 只发布已存在的提交版本，不会重新提交草稿
- `fornax experiment create` 建议使用 `--request-file` 传入完整 JSON；至少需要 `workspace_id`、`name`、`eval_set_param.eval_set_id` 和 `eval_set_param.version`
- `fornax experiment results` 默认分页参数是 `--page 1 --page-size 20`
- `--json` 模式下如果 experiment 缺少凭据，CLI 会额外输出 `action_required` 事件，并在错误对象里带 `error.hint`

## References

- `references/fornax.md`
- `references/invocation.md`
- `references/troubleshooting.md`

## Trace 链路排查

用于查询 Fornax `spans/list` 并输出调用链摘要。

### 最简输入

```bash
bytedcli fornax trace --logid <logid>
bytedcli fornax trace --trace-id <trace_id>
bytedcli --json fornax trace --logid <logid>
```

- `logid` 或 `trace-id` 二选一。
- 默认 `workspace-id` 为 `7485358401870888962`。

### 默认行为与鉴权

- 自动补齐：默认查询最近 72 小时，按 `start_time` 倒序，排除 `boe` 环境。可通过 `--lookback-hours` 调整。
- 鉴权：默认复用 `bytedcli auth login` 凭据。也可复用 `fornax auth config` 实验凭据，或通过 `--jwt-token <token>` 单次覆盖。

### 失败排查

- `user not login` / 401：执行 `bytedcli auth login`，或传入 `--jwt-token`。
- 无结果：检查 `logid` 是否正确，或扩大 `--lookback-hours`。
- 异常节点多：优先围绕最耗时或最早报错的 span 向下钻取。
