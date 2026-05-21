# Tardis CLI Reference

Tardis 是字节内部的模型服务/流水线平台，bytedcli 通过 `tardis` 命令组提供：项目资源查询、shadow 模型查询、流水线节点能力发现与执行。

## 命令

### `tardis project list`

列出 Tardis 项目资源。

```bash
bytedcli tardis project list --base-url <baseUrl> [options]
```

**Options:**
- `--base-url <baseUrl>` — Tardis API base URL，必填（不同部署不同，如 `https://tardis.example.com`）。
- `--path <path>` — 接口路径，默认 `/api/v1/projects`。
- `--page <page>` — 页码，默认 `1`。
- `--page-size <pageSize>` — 每页大小，默认 `20`。
- `--page-param <name>` — 页码 query 参数名，默认 `page`。
- `--page-size-param <name>` — 每页大小 query 参数名，默认 `page_size`。

**Example:**

```bash
bytedcli tardis project list --base-url https://tardis.example.com
```

---

### `tardis shadow query`

按 `space_id` 查询 shadow 模型列表。host 自动按 `BYTEDCLI_NETWORK_PROFILE` 切换办公网/生产网。

```bash
bytedcli tardis shadow query [--space-id <spaceId>]
```

**Options:**
- `--space-id <spaceId>` — Tardis space_id，默认 `18`。

**Example:**

```bash
bytedcli tardis shadow query
bytedcli tardis shadow query --space-id 19
BYTEDCLI_NETWORK_PROFILE=prod bytedcli --json tardis shadow query --space-id 19
```

---

### `tardis service node-types`

列出流水线支持的所有 node 类型，以及每个类型在 `execute` action 下的必填字段。**这是调用 `tardis service run` 前的"自描述"接口，agent 应优先调用一次拿到字段清单。**

```bash
bytedcli tardis service node-types
```

**输出列：** `Node Type`, `Display Name`, `Required Fields`, `Description`。`--json` 模式下 `node_types[].required_fields[]` 保留每条字段的原始 raw 信息，便于上层程序化消费。

---

### `tardis service run`

触发流水线 node 能力，或检查任务是否完成。

```bash
bytedcli tardis service run --node-type <nodeType> --action <action> [--body <json> | --body-file <path>]
```

**Options:**
- `--node-type <nodeType>` — Node 类型，必填，例如 `DEPLOY_MODEL`、`TRAIN_SHARE_WEIGHT_MODEL`。先用 `tardis service node-types` 列出可选值。
- `--action <action>` — `execute`（执行）或 `check_finished`（查询是否完成），默认 `execute`。
- `--body <json>` — 内联 JSON body。
- `--body-file <path>` — 从 JSON 文件读取 body。

**字段探测约定（重要）：**

CLI 故意不在本地校验 `--body` 字段，省略 `--body` 时后端会返回结构化错误，明确列出缺哪些字段，例如：

```json
{ "msg": "缺少必要参数: input_job_id (or input_model_name), submitter", "code": -1 }
```

按 `msg` 提示补 `--body` 再次执行即可。

**`submitter` 字段约定：**

- 必须填**邮箱前缀**，例如 `zhangsan@bytedance.com` → `submitter: "zhangsan"`。
- AI agent 代发起时，使用当前 bytedcli 已登录用户的邮箱前缀，**不要**填 `agent`/`bot`/`ai` 这类字面量。
- 邮箱前缀来源（按优先级）：
  1. `~/.local/share/bytedcli/data/userinfo.json` 中的 `username`。
  2. `bytedcli --json auth status` / `auth userinfo` 返回的 username。
  3. 让用户在对话中明确指定。

**Examples:**

```bash
# 探测 TRAIN_SHARE_WEIGHT_MODEL execute 缺哪些字段
bytedcli tardis service run --node-type TRAIN_SHARE_WEIGHT_MODEL --action execute

# 用 input_job_id + submitter 触发训练共享权重
bytedcli tardis service run \
  --node-type TRAIN_SHARE_WEIGHT_MODEL \
  --action execute \
  --body '{"input_job_id":"<job_id>","submitter":"<email_prefix>"}'

# 用 input_model_name 触发
bytedcli tardis service run \
  --node-type TRAIN_SHARE_WEIGHT_MODEL \
  --action execute \
  --body '{"input_model_name":"<model_name>","submitter":"<email_prefix>"}'

# 通过 JSON 文件提交（字段较多时推荐）
bytedcli tardis service run \
  --node-type DEPLOY_MODEL \
  --action execute \
  --body-file ./deploy.json

# 查询某次任务是否完成
bytedcli tardis service run \
  --node-type TRAIN_SHARE_WEIGHT_MODEL \
  --action check_finished \
  --body '{"task_id":"<task_id>"}'
```

**Notes:**

- `--body` 与 `--body-file` 互斥；都不传时 body 为 `undefined`，后端按"缺字段"返回提示。
- 返回里 `data` 字段保留后端原始响应（包括缺字段错误结构）；`--json` 模式下可直接判断 `code != 0` 走失败分支。
- host 自动按 `BYTEDCLI_NETWORK_PROFILE=prod` 切到生产网；不要再额外加 `--base-url` 来"切环境"，base URL 解析统一在 `src/api/tardis/site.ts` 完成。

## 鉴权

- 先 `bytedcli auth login` 完成 SSO 登录。
- Tardis 接口走 Titan Passport cookie 鉴权（由 bytedcli 自动注入）。
- 切换到生产网 host：`export BYTEDCLI_NETWORK_PROFILE=prod`。
