# OneService 错误码

OneService CLI 把后端的 `Code` 数字与 `action_required` 字符串映射到两个输出通道：

- **错误**（stderr，非 0 退出）—— 类型化的 `AppError`，`code` 字段稳定。调用方必须按 Recovery 列处理
- **Next-action 提示**（stdout JSON，退出 0）—— 成功响应里附 `next_action` 块，建议下一步该跑哪条命令

---

## 错误（非 0 退出）

| Code | 触发 | Recovery | 示例 |
|---|---|---|---|
| `ONESERVICE_AUTH_EXPIRED` | 后端 `Code=1003`，或 `action_required=CALL_ONESERVICE_AUTH_SKILL` | 对当前站点跑 `bytedcli auth login`（每个 SSO 独立，TikTok 站点和 ByteDance 站点登录态不互通） | `bytedcli --site i18n-tt auth login` |
| `ONESERVICE_API_NAME_CONFLICT` | 后端 `Code=1219`，或 `api create` 时 `action_required=STOP_AND_ASK_USER` | 让用户给新 `--name`，**不要自动加后缀** | n/a |
| `ONESERVICE_API_VERSION_DRAFT_EXISTS` | `api create-version` / `api copy-version` 命中 `action_required=CONFIRM_OR_UPDATE_DRAFT` | 选其一：用 `api update-version` 改已有草稿；或用户明确确认后给 `api create-version` 加 `--allow-draft` | `oneservice api create-version --api-id <id> --allow-draft --sql "..."` |
| `ONESERVICE_API_VERSION_PUBLISHED` | `api update-version` 命中 `action_required=CREATE_NEW_VERSION`，或 handler 的 `is_published` 自检 | 改用 `api create-version` 传同样的 flag。**不要**先 publish-offline 再改 —— 已发布版本是故意做成不可变的 | `oneservice api create-version --api-id <id> --sql "<new sql>"` |
| `ONESERVICE_API_TEST_SQL_REQUIRED` | 对 `query_type="origin"` 的 API 跑 `api test` 但没传 SQL，触发 `action_required=ASK_USER` | 加 `--request-data '{"Sql":"SELECT ..."}'`（**大写 S**） | `oneservice api test --api-id <id> --request-data '{"Sql":"SELECT 1"}'` |
| `ONESERVICE_API_TEST_PARAMS_MISSING` | `api test` 时 `action_required=FIX_PARAM` 且后端列出了 `missing_params`（请求数据缺必填占位符） | 从 JSON 输出读 `error.details.missingParams`，把缺的 key 补到 `--request-data`，重试 | n/a |
| `ONESERVICE_API_BUILD_FAILED` | `api create-version` / `api update-version` 时后端构建/校验失败（`action_required=FIX_PARAM` 但 `missing_params` 为空），常见为 `logic_table_name` 解析不到、SQL 语法非法、`filter_fields` 与占位符不匹配 | 读 `error.message` / `error.hint` / `error.details.backendCode` / `error.details.backendMessage` 取后端真实原因。`logic table not found` 类先用 `oneservice logic search` 确认逻辑表存在；SQL 语法问题先在 IDE 试跑 | n/a |
| `ONESERVICE_AUTH_PSM_NOT_REGISTERED` | `auth grant` 时后端返回 `code=-1` + `message="no app found"`（PSM 未在 OneService App 表注册） | **先与用户确认**是否注册该 PSM；确认后按 `error.details.recoveryCommands` 串 `auth create-app --psm <psm>` + 重试 `auth grant`。**不要**静默自动注册 | `oneservice auth create-app --psm dp.demo.svc && oneservice auth grant --api-id <id> --psm dp.demo.svc` |
| `ONESERVICE_PERMISSION_DENIED` | 后端 `Code=403` | 找项目 owner 申请 `project_admin` 或 `query_develop` 权限 | n/a |
| `ONESERVICE_NOT_FOUND` | 后端 `Code=404` | 核对 `--api-id` / `--project-id` / `--version-id`；资源可能已被删 | n/a |
| `ONESERVICE_BACKEND_ERROR` | 后端返回非 0 `Code`，但没有更具体的映射 | 从 JSON 输出读 `error.details.backendCode` 与 `error.message` | n/a |
| `ONESERVICE_SITE_UNSUPPORTED` | 传了 `--site us-ttp` / `eu-ttp` / `us-ttp-bdee` / `us-ttp-usts` 之类不支持的站点 | 改用 `cn` / `i18n-tt` / `i18n-bd` / `boe` 之一 | n/a |
| `ONESERVICE_PROJECT_NOT_FOUND` | `--project-name <kw>` 通过 `listProjects` 解析为 0 个项目 | 跑 `oneservice project list --keyword <kw>` 核对名称；不确定时直接传 `--project-id` | n/a |

---

## Next-action 提示（退出 0）

| `next_action.kind` | 触发 | 建议下一步 |
|---|---|---|
| `VERIFY_AUTH_LIST` | `auth grant` 成功后后端返回 `action_required=CALL_LIST_AUTH_TO_VERIFY` | 接着跑 `bytedcli oneservice auth list --api-id <id>` 确认 PSM 已在授权列表里。Agent 应自动串起来 |
| `MULTIPLE_RESULTS_SELECT_ONE` | 后端 `action_required=MUST_SELECT_ONE`（例如 `logic search` 命中多行） | **把所有结果展示给用户**由用户挑一条，禁止自动选第一条 |

`next_action` 块固定带两个字段：`command`（推荐的下一条 bytedcli 命令）和 `reason`（后端给的触发字符串）。
