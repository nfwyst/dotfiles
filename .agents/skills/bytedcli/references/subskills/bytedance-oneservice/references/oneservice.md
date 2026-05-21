# OneService CLI 命令参考

> 所有命令都以 `bytedcli oneservice` 开头。全局 flag（`--json` / `--site` / `--http-debug`）必须放在子命令**前面**：`bytedcli --json oneservice ...`
>
> 站点选择：`--site cn`（默认，CN 生产）| `i18n-tt`（SG / TikTok）| `i18n-bd`（MYBD / ByteIntl）
> 其它 cloud 站点（`us-ttp` / `eu-ttp` / `boe` 等）暂不支持，会被显式拒绝，抛 `ONESERVICE_SITE_UNSUPPORTED`

---

## project list

```
bytedcli oneservice project list [--keyword <substring>]
```

列出当前用户有创建权限的所有 OneService 项目。

- `--keyword`：在项目名上做客户端子串匹配（大小写不敏感）
- 返回字段：`id`、`name`、`owner`、`business_id`

```bash
bytedcli oneservice project list
bytedcli --json oneservice project list --keyword demo
```

---

## folder list / folder create

```
bytedcli oneservice folder list   --project-id <projectId>
bytedcli oneservice folder create --project-id <projectId> --name <folderName>
```

- `list` 返回项目下每个文件夹的 `title` 和 `file_count`
- `create` 不允许重名。`oneservice api create --folder` 已经会自动 ensure 文件夹，所以这条命令很少直接用

```bash
bytedcli oneservice folder list --project-id 1234567890123456789
bytedcli oneservice folder create --project-id 1234567890123456789 --name ai_generated
```

---

## logic search / logic get

```
bytedcli oneservice logic search --project-id <projectId> --keyword <kw>
bytedcli oneservice logic get    --logic-table-id <logicTableId>
```

- `search` 是项目内搜索；多结果时返回 `next_action.kind = MULTIPLE_RESULTS_SELECT_ONE`（成功，退出 0）。**所有命中都要展示给用户，不要自动选第一条**
- `get` 返回 `db_name`、`table_name`、`fields[]`（每个含 `name` / `type` / `description`）

```bash
bytedcli oneservice logic search --project-id 1234567890123456789 --keyword order
bytedcli --json oneservice logic get --logic-table-id 12345
```

---

## api list

```
bytedcli oneservice api list --project-id <projectId> [--keyword <substring>]
```

- `--keyword`：在 API 名上做客户端子串匹配
- 返回字段：`id`、`name`。后端目前只填这两项，`description` / `query_type` / `folder_name` 在响应里通常为空，如果需要这些字段请改用 `api get --api-id <id>` 拿完整 `ApiInfo`

---

## api create

```
bytedcli oneservice api create
  --name <name>                          # 必填，项目内唯一
  (--project-id <id> | --project-name <kw>)
  [--type script|guide|origin|workflow|http|httpscript]   # 默认 script
  [--sql <sql>]                          # script 必填，guide / origin 不允许
  [--logic-table-name <name1> [<name2> ...]]  # technical name 数组（注意：不是 ID）
  [--folder <name>]                      # 缺失时自动 ensure
  [--description <desc>]
```

请求体组装成 `CreateApiBody`：

| 字段               | 来源                                           | 备注                |
| ------------------ | ---------------------------------------------- | ------------------- |
| `project_id`       | `--project-id`（或从 `--project-name` 解析）   | string              |
| `name`             | `--name`                                       | 项目内唯一          |
| `query_type`       | `QUERY_TYPE_TO_NUMBER[--type]`                 | 数字 1..6           |
| `sql`              | `--sql`                                        | 只 script 用        |
| `logic_table_name` | `--logic-table-name`（variadic）               | technical name 数组 |
| `folder_name`      | `--folder`                                     | 可选                |
| `description`      | `--description`                                | 可选                |
| `filter_fields`    | 从 SQL 中所有 `#{name}` 占位符自动提取         | `FilterField` 数组  |
| `return_fields`    | 从 SELECT 列表自动提取（`SELECT *` → `["*"]`） | `string[]`          |

```bash
bytedcli oneservice api create --project-id 1234567890123456789 \
  --name demo_query --type script \
  --sql "SELECT user_id FROM dwd_user WHERE dt = #{dt}" \
  --logic-table-name dwd_user
```

可能错误：`ONESERVICE_API_NAME_CONFLICT` / `ONESERVICE_PROJECT_NOT_FOUND`

---

## api update

```
bytedcli oneservice api update --api-id <apiId>
  [--name <name>]
  [--qps <number>]
  [--cache-rate-limit <rate>]
  [--owner <user1> [<user2> ...]]
```

**后端只认这 4 个字段，其它字段静默丢弃**：

| CLI flag             | 请求体路径                   | 类型                                     |
| -------------------- | ---------------------------- | ---------------------------------------- |
| `--name`             | `name`                       | string                                   |
| `--qps`              | `base_conf.qps`              | string（CLI 收数字，序列化时转成字符串） |
| `--cache-rate-limit` | `base_conf.cache_rate_limit` | string                                   |
| `--owner`            | `owner`                      | string[]                                 |

要改 SQL / logic-table，用 `api create-version` 或 `api update-version`，不要用 `api update`。

---

## api get

```
bytedcli oneservice api get --api-id <apiId> [--version <versionNumber>]
```

两种调用形态：

- **传 `--version`** — 返回该 API 指定版本的完整 `ApiInfo` 详情；JSON 输出形如 `{ api_id, version, detail }`，文本模式渲染 KV 表。
- **不传 `--version`** — 返回该 API 所有版本的元信息数组；JSON 输出形如 `{ api_id, count, versions: ApiInfo[] }`，文本模式渲染版本摘要表（`Version` / `Version ID` / `Query Type` / `Version Publish Env` / `Modifier`）。不要再假设默认是 `0`/latest——后端不带 `version` 时返回的是完整版本列表。

单版本详情常用字段：

| 字段                                          | 类型            | 说明                                                                                     |
| --------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| `id` / `uid`                                  | number / string | `id` 是 number 形式（受 JSON 大整数精度影响），`uid` 是 string 形式，下游建议用 `uid`    |
| `name`                                        | string          | API 名称                                                                                 |
| `query_type`                                  | string          | 字面枚举：`"script"` / `"guide"` / `"origin"` / `"workflow"` / `"http"` / `"httpscript"` |
| `version`                                     | number          | 当前版本号                                                                               |
| `version_id`                                  | number          | 版本 ID（同样受精度影响）                                                                |
| `project_id_str`                              | string          | project ID 的 string 形式（推荐用这个）                                                  |
| `creator` / `modifier`                        | string          | 创建者 / 最后修改者 user_code                                                            |
| `engineGrammarType`                           | string          | SQL 引擎类型，如 `"mysql"`                                                               |
| `param_info.sql_text`                         | string          | API 的 SQL 文本（不是顶层 `sql`，且 origin 类型为空）                                    |
| `param_info.logic_table_ids`                  | number[]        | logic table ID 数组（嵌套在 `param_info` 内，不在 detail 顶层）                          |
| `param_info.request_param` / `response_param` | array           | 请求 / 响应字段定义                                                                      |
| `base_conf`                                   | object          | `qps` / `cache_rate_limit` / `time_out` 等                                               |
| `query_settings`                              | object          | `cache_strategy` / `cache_ttl` / `enable_page` 等                                        |
| `query_publish_env`                           | string          | API 发布环境，**逗号分隔**：`"ONLINE,PPE"` / `"BOE,PPE,ONLINE"`                          |
| `version_publish_env`                         | string          | 当前版本的发布环境（同样逗号分隔）                                                       |
| `folder_id` / `folder_name`                   | number / string | 所在文件夹                                                                               |

> `param_info.logic_table_ids` 是只读输出。创建 / 更新 API 时必须用 `--logic-table-name` 传 **name**，不能传这里的 ID。
> 已知问题：后端不返回 `ide_url`；`logic_table_ids` 数组里的元素是 number，存在 JSON 大整数精度截断问题，无法直接喂给 `logic get --logic-table-id <id>`，需要从 UI 复制完整 string ID。

---

## api test

```
bytedcli oneservice api test --api-id <apiId>
  [--version <versionNumber>]
  [--request-data <json>]    # 测试参数 JSON 字符串；不是 --json
  [--dryrun]                 # 只渲染 SQL 不执行
```

- `--request-data` 接一个 JSON 对象，key 是 SQL 占位符名
- **origin（`type=origin`）API 必须传 `--request-data '{"Sql": "SELECT ..."}'`（大写 S）**：origin 的 SQL 是逐次调用现传，不存在 API 上
- `--dryrun` 渲染解析后的 SQL 但不执行

```bash
bytedcli oneservice api test --api-id 12345 --request-data '{"dt":"2026-04-29"}'
bytedcli oneservice api test --api-id 67890 --request-data '{"Sql":"SELECT 1"}'   # origin
```

可能错误：`ONESERVICE_API_TEST_SQL_REQUIRED` / `ONESERVICE_API_TEST_PARAMS_MISSING`

---

## api list-versions

```
bytedcli oneservice api list-versions --api-id <apiId>
```

返回 `Version[]`：`id`、`version`（数字）、`status[]`（如 `["ONLINE", "PPE"]` 或 `["not_publish"]`）、`description`、`creator`、`create_time`、`is_published`（派生：`status` 含 `ONLINE` / `PPE` / `BOE` 任意一个时为 `true`）。

---

## api create-version

```
bytedcli oneservice api create-version --api-id <apiId>
  [--source-version <versionNumber>]   # 从这个版本继承参数
  [--sql <sql>]
  [--logic-table-name <name...>]
  [--description <desc>]
  [--allow-draft]                      # 绕过草稿 guard
```

草稿 guard：CLI 默认会先调 `listVersions`，如果已经有未发布草稿就直接拒绝，抛 `ONESERVICE_API_VERSION_DRAFT_EXISTS`。`--allow-draft` 必须在用户明确确认后才能加。详见 `api-version-flow.md`。

---

## api update-version

```
bytedcli oneservice api update-version
  --api-id <apiId>           # is_published 自检需要
  --version-id <versionId>
  [--sql <sql>]
  [--logic-table-name <name...>]
  [--description <desc>]
```

`--api-id` 是必填，因为 handler 会通过 `listVersions` 做 `is_published` 自检。如果目标版本已发布，CLI 抛 `ONESERVICE_API_VERSION_PUBLISHED` —— 恢复路径是用同样的 flag 调 `api create-version`。

---

## api copy-version

```
bytedcli oneservice api copy-version --api-id <apiId> [--source-version <versionNumber>]
```

一条用户视角的命令，内部由 `services/oneservice/orchestration.ts` 串起 4 步后端调用：

1. `listVersions` —— 解析源版本（不传 `--source-version` 时取最新）
2. `getApi` —— 读源版本的 SQL 和 `logic_table_ids`
3. `getLogic` × N —— 把每个 logic-table ID 反查回 technical name
4. `createVersion` —— 写一条新草稿，沿用同样的 SQL / 参数

用户只需跑这一条命令，**不要**手动串这 4 步。

---

## api publish / api unpublish

发布与下线拆成两个独立子命令；不再通过 `--status 0|1` 切换语义。

```
bytedcli oneservice api publish   --api-id <apiId>
  --env ONLINE [PPE BOE ...]   # variadic，至少传一个
  [--version <versionNumber>]  # 默认最新

bytedcli oneservice api unpublish --api-id <apiId>
  --env ONLINE [PPE BOE ...]   # 要下线的环境
  [--version <versionNumber>]  # 默认最新
```

```bash
bytedcli oneservice api publish   --api-id 12345 --env ONLINE
bytedcli oneservice api unpublish --api-id 12345 --env BOE
bytedcli oneservice api publish   --api-id 12345 --env ONLINE PPE --version 3
```

---

## auth grant

```
bytedcli oneservice auth grant
  --api-id <apiId>
  --psm <psm>                 # 单个 PSM，或用逗号分隔多个
  [--qps <number>]
  [--invoke-owner <user>]
```

`--psm "a.b.c,d.e.f"` 一次后端调用就能注册两个 PSM。成功响应里带 `next_action.kind = VERIFY_AUTH_LIST`，agent 应紧接着调 `auth list --api-id <id>` 确认 PSM 已落入授权列表。

---

## auth list

```
bytedcli oneservice auth list --api-id <apiId>
```

返回 `AuthEntry[]`：`auth_id`、`psm`、`qps_limit`、`invoke_owner`、`create_time`。

---

## auth create-app

```
bytedcli oneservice auth create-app --psm <psm>
```

注册一个新 App（PSM），后续可以用 `auth grant` 给它授权。即使 PSM 已注册过，后端也会返回友好的「已存在」消息，CLI 视为成功，直接进入 `auth grant` 即可。

---

## logic table 使用注意

- `--logic-table-name <name1> [<name2> ...]` 接一个或多个 **technical name**（即 `oneservice logic search` / `get` 返回的 `name` 字段），不接 ID。CLI 内部把它们组装成请求体里的 `logic_table_name: string[]`。Flag 名特意带 `-name` 后缀，与 `logic get --logic-table-id` 区分，避免歧义
- `param_info.logic_table_ids` 是 `api get` 返回的**只读**字段（嵌套在 `param_info` 内，不在 detail 顶层）。**不要**把这里的 ID 反过来再喂给 create / update —— 先用 `logic get --logic-table-id <id>` 翻成 name 再传
- `services/oneservice/orchestration.ts` 在 `copy-version` 内部已经自动做了 ID → name 的反查
