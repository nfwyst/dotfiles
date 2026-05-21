# OneService API 版本流程

## 状态

每个 OneService API 至少有一个版本。每个版本处于以下两种状态之一：

- **草稿（`not_publish`）**：可以原地编辑，用 `api update-version` 修改
- **已发布**：已经部署到一个或多个环境（`ONLINE` / `PPE` / `BOE`）。**不可变** —— 任何改动都必须通过 `api create-version` 起一个新草稿

CLI 把这个区分暴露成派生字段 `is_published`，挂在 `api list-versions` 返回的每个 `Version` 对象上。`is_published === true` 当且仅当 `status[]` 含 `ONLINE` / `PPE` / `BOE` 中任意一个。

---

## 生命周期

1. `api create` 自动建初始版本（V0，草稿）
2. `api create-version` 起一个新草稿，可选用 `--source-version` 从已有版本继承参数
3. `api update-version` 原地改某个**未发布**的草稿
4. `api publish --env ONLINE`（或 `PPE` / `BOE`）把草稿发布到对应环境
5. `api unpublish --env <env>` 把已发布版本从某个环境下线

---

## update-version 自检

`api update-version` 必须同时传 `--api-id` 和 `--version-id`。handler 会先调 `listVersions(api-id)` 拿到目标版本的 `is_published`：

- 仍是草稿 → 继续走 `updateVersion`
- 已发布 → 抛 `ONESERVICE_API_VERSION_PUBLISHED`。**Recovery 是用同样的 flag 调 `api create-version`**，**不要**先 publish-offline 再改 —— 已发布版本是故意做成不可变的

```bash
# 如果 v3 已经在 ONLINE 上，下面这条会抛 ONESERVICE_API_VERSION_PUBLISHED：
bytedcli oneservice api update-version --api-id 12345 --version-id v3 --sql "..."

# 正确的恢复路径：
bytedcli oneservice api create-version --api-id 12345 --sql "..."
```

---

## create-version 草稿 guard

`api create-version` 会先调 `listVersions`，如果当前 API 已经有未发布草稿，handler 抛 `ONESERVICE_API_VERSION_DRAFT_EXISTS`。两种恢复方式：

- **改已有草稿**（推荐）：
  `oneservice api update-version --api-id <id> --version-id <existingDraftId> --sql ...`
- **强制再起一个草稿**，仅在用户明确确认后：
  `oneservice api create-version --api-id <id> --allow-draft --sql ...`

`--allow-draft` 是绕过 guard 的唯一方式。**不要**静默重试加 `--allow-draft`，必须先和用户确认。

---

## copy-version（4 步链编排）

`api copy-version --api-id <id> [--source-version <n>]` 是一条用户视角的命令，内部串了 4 个后端调用：

1. `listVersions(api-id)` —— 解析源版本（不传 `--source-version` 时取最新）
2. `getApi(api-id, version=<source>)` —— 读源版本的 SQL（`param_info.sql_text`）、`param_info.logic_table_ids`、参数
3. `getLogic(logicId)` × N —— 把每个 `logic_table_id` 反查回 logic table name（创建接口认 name 不认 ID）
4. `createVersion` —— 写一条新草稿，沿用同样的 SQL / 参数 / logic-table 名称

新草稿继承源版本的 SQL 和参数，**不会**自动发布。用户只需跑这一条命令：

```bash
bytedcli oneservice api copy-version --api-id 12345 --source-version 3
```

如果 API 已经有未发布草稿，copy-version 同样会命中 draft guard，抛 `ONESERVICE_API_VERSION_DRAFT_EXISTS`。

---

## 不同场景该用哪条命令

| 目标                                                        | 命令                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------- |
| 原地改一条未发布草稿                                        | `api update-version`                                    |
| 从零写一个新版本                                            | `api create-version --sql ...`                          |
| 把已有版本（已发布或草稿）整体克隆为新草稿，保留 SQL 和参数 | `api copy-version --api-id <id> [--source-version <n>]` |
| 把草稿发布到 ONLINE / PPE / BOE                             | `api publish --env <env>`                               |
| 把已发布版本下线                                            | `api unpublish --env <env>`                             |
