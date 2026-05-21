---
name: bytedance-tardis
description: "Operate Tardis pipeline node capabilities (model deploy, share-weight training, etc.) via bytedcli: list project resources, query shadow models by space_id, list supported pipeline node types and required fields, and run/check pipeline node actions with a JSON --body. Use when tasks mention Tardis, Tardis pipeline, pipeline node, DEPLOY_MODEL, TRAIN_SHARE_WEIGHT_MODEL, shadow models, share-weight training, model deploy via Tardis, or 'tardis service run/check_finished'."
---

# bytedcli Tardis

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

- 列出 Tardis 项目资源（`tardis project list`）
- 按 `space_id` 查询 shadow 模型列表（`tardis shadow query`）
- 列出 Tardis 流水线支持的 node 类型与每个 node 的必填字段（`tardis service node-types`）
- 触发流水线 node 能力，例如部署模型 `DEPLOY_MODEL`、训练共享权重 `TRAIN_SHARE_WEIGHT_MODEL` 等（`tardis service run --action execute`）
- 查询某次 node 任务是否完成（`tardis service run --action check_finished`）

## Agent Guidance

**网络环境（自动切换 host）：** Tardis 默认走办公网 host，遇到生产网才能访问的接口时，通过环境变量切换：

```bash
BYTEDCLI_NETWORK_PROFILE=prod bytedcli tardis service node-types
```

不要为了"切环境"再额外加 `--base-url`，host 解析统一在 `src/api/tardis/site.ts` 完成。

**`tardis service run` 标准探测流程（推荐 agent 默认遵循）：**

1. 先执行 `bytedcli tardis service node-types`，找到目标 `node_type`，记下 `required_fields[].field` 列表。
2. 用最小信息发起一次 `tardis service run`：先省略 `--body` 直接调用，让后端把缺哪些字段告诉你。例如：
   ```bash
   bytedcli tardis service run --node-type TRAIN_SHARE_WEIGHT_MODEL --action execute
   ```
   后端通常会返回结构化错误，例如：
   ```json
   { "msg": "缺少必要参数: input_job_id (or input_model_name), submitter", "code": -1 }
   ```
3. 按 `msg` 提示补 `--body`（inline JSON）或 `--body-file`（JSON 文件）再执行；继续报缺字段就继续补，直到任务被接受。
4. 拿到返回里的 `task_id` 后用 `--action check_finished` 查询任务状态：
   ```bash
   bytedcli tardis service run --node-type TRAIN_SHARE_WEIGHT_MODEL --action check_finished --body '{"task_id":"<task_id>"}'
   ```

**`submitter` 字段约定（必须遵循）：**

- `submitter` **必须是发起人的邮箱前缀**，例如邮箱 `zhangsan@bytedance.com` → `submitter: "zhangsan"`。
- AI agent 代用户调用时，**不要**写成 `agent`、`bot`、`ai` 等字面量；应使用当前已登录到 bytedcli 的用户邮箱前缀，或经鉴权者明确授权使用其邮箱前缀。
- 邮箱前缀获取方式（任选其一，优先级从上到下）：
  1. 读取 `~/.local/share/bytedcli/data/userinfo.json` 中的 `username`（这是 bytedcli 登录后保存的邮箱前缀）。
  2. `bytedcli --json auth status` / `auth userinfo` 返回中的 username。
  3. 由当前发起任务的用户在对话中明确指定。
- 若 agent 无法可靠拿到邮箱前缀，**必须先向用户索要**，不要凭空填值。Tardis 后端会按 `submitter` 做配额、审计与权限控制，错填会污染审计记录。

**关于 `input_job_id` / `input_model_name` 等业务字段：**

- 这些字段值通常来自上游训练任务、模型仓库或用户指定，**不要猜测或编造**。
- 如果用户未提供，先反问获取；或先用其他工具（例如训练平台、模型仓库的查询命令）拿到具体 ID 后再调用 Tardis。

**JSON 模式：**

- 需要解析返回结果时，加全局 `--json`：`bytedcli --json tardis service run ...`。
- `tardis service run` 的 `data` 字段保留后端原始响应（包括缺字段错误结构），便于 agent 编程式判断 `code != 0` 的失败分支。

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要先 `bytedcli auth login` 完成 SSO 登录；后续 Tardis 接口走 Titan Passport cookie 鉴权。
- 切换到生产网 host：`export BYTEDCLI_NETWORK_PROFILE=prod`。

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 1. 查看支持的 node 类型与必填字段
bytedcli tardis service node-types

# 2. 探测某个 node 缺哪些字段（先不传 body）
bytedcli tardis service run --node-type TRAIN_SHARE_WEIGHT_MODEL --action execute

# 3. 按后端提示补 body 再发起执行（submitter 用邮箱前缀）
bytedcli tardis service run \
  --node-type TRAIN_SHARE_WEIGHT_MODEL \
  --action execute \
  --body '{"input_job_id":"<job_id>","submitter":"<email_prefix>"}'

# 4. 查询任务是否完成
bytedcli tardis service run \
  --node-type TRAIN_SHARE_WEIGHT_MODEL \
  --action check_finished \
  --body '{"task_id":"<task_id>"}'

# Shadow 模型查询（默认 space_id=18）
bytedcli tardis shadow query
bytedcli tardis shadow query --space-id 19

# Project 列表（需要显式 base-url）
bytedcli tardis project list --base-url https://tardis.example.com
```

字段较多时推荐 `--body-file`：

```bash
# payload.json
# {
#   "input_job_id": "<job_id>",
#   "submitter": "<email_prefix>"
# }
bytedcli tardis service run \
  --node-type TRAIN_SHARE_WEIGHT_MODEL \
  --action execute \
  --body-file ./payload.json
```

## Notes

- `tardis service run` 故意不在 CLI 端校验 `--body` 字段；缺字段时透传后端结构化错误，便于 agent 按 `msg` 多轮补全。
- `--action` 当前支持 `execute` 和 `check_finished`；其他取值会被 CLI 提前拒绝。
- `--body` / `--body-file` 二选一；都不传时 body 为 `undefined`，后端会按"缺字段"返回提示。
- 默认 host 走办公网；`BYTEDCLI_NETWORK_PROFILE=prod` 切到生产网，对 `service node-types` / `service run` / `shadow query` 同时生效。
- `tardis project list` 需要显式 `--base-url`，因为不同 Tardis 部署的 project 路径不一样。

## References

- `references/tardis.md`
