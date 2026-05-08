# Fornax via bytedcli

优先用 `bytedcli --json fornax ...` 调用 Fornax 能力。

## 推荐命令

- Workspace：`fornax list-workspace`
- Prompt：`fornax list-prompt|get-prompt|create-prompt|update-prompt`
- Publish：`fornax publish-prompt`
- Experiment 认证：`fornax auth config|status`
- Experiment：`fornax experiment create|get|results|aggr-results`

## 常见流程

### Prompt / workspace / publish

1. `bytedcli auth login`
2. `bytedcli --json fornax list-workspace`
3. `bytedcli --json fornax list-prompt --space-id <space-id>`
4. `bytedcli --json fornax get-prompt --space-id <space-id> --prompt-id <prompt-id> --personal-draft`
5. `bytedcli --json fornax create-prompt ...` 或 `update-prompt ...`
6. `bytedcli --json fornax publish-prompt --space-id <space-id> --prompt-id <prompt-id> --target <boe|ppe|online> --submit-version <version>`

### Experiment

1. `bytedcli --json fornax auth status`
2. `bytedcli fornax auth config --access-key <ak> --secret-key <sk>`
3. `bytedcli --json fornax experiment create --request-file ./experiment.json`
4. `bytedcli --json fornax experiment get --workspace-id <space-id> --experiment-id <experiment-id>`
5. `bytedcli --json fornax experiment results --workspace-id <space-id> --experiment-id <experiment-id> --page 1 --page-size 20`
6. `bytedcli --json fornax experiment aggr-results --workspace-id <space-id> --experiment-id <experiment-id>`

## 认证边界

- 普通 Fornax 命令：`list-workspace`、`list-prompt`、`get-prompt`、`create-prompt`、`update-prompt`、`publish-prompt`
  - 复用 `bytedcli auth login`
- `fornax experiment *`
  - 使用 `fornax auth config`、CLI flags，或 experiment 专用环境变量

## 常用示例

```bash
bytedcli --json fornax list-prompt --space-id <space-id> --keyword demo --page 1 --page-size 20

bytedcli --json fornax create-prompt \
  --space-id <space-id> \
  --prompt-key team.demo.prompt \
  --display-name "Demo Prompt" \
  --system-prompt "You are concise."

bytedcli --json fornax update-prompt \
  --space-id <space-id> \
  --prompt-id <prompt-id> \
  --message-list-file ./messages.json \
  --model-config-file ./model-config.json

bytedcli --json fornax publish-prompt \
  --space-id <space-id> \
  --prompt-id <prompt-id> \
  --target online \
  --version 1.0.1 \
  --comment "promote to prod"

bytedcli fornax auth config --jwt-token <token>

bytedcli --json fornax experiment results \
  --workspace-id <space-id> \
  --experiment-id <experiment-id> \
  --page 2 \
  --page-size 50
```
