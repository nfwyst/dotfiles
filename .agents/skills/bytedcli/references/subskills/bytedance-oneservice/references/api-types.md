# OneService API 类型

`oneservice api create --type` 接受 6 种字面枚举：`script | guide | origin | workflow | http | httpscript`。

内部数字映射（仅 `api create` 写入请求体时由 CLI 转成数字，**只读路径不暴露**：`api get` 返回的 `query_type` 字段是字符串字面值如 `"script"`）：

| 字符串 | 写请求体的数字 | 典型用途 |
|---|---|---|
| `script`     | 1 | 脚本式，带 `#{placeholder}` 占位符的参数化 SQL（最常见） |
| `guide`      | 2 | 向导式，需显式声明 filter / return 字段 |
| `origin`     | 3 | 原生式，调用时由调用方现传 SQL |
| `workflow`   | 4 | 编排查询（仅控制面支持） |
| `http`       | 5 | 外部 HTTP 接口（仅控制面支持） |
| `httpscript` | 6 | HTTP + 后处理脚本（仅控制面支持） |

CLI 端到端只覆盖 `script` 和 `origin`。`guide` 必须去 OneService 控制面创建；`workflow` / `http` / `httpscript` 也是只能在控制面操作。

---

## script（脚本式，最常见）

- 必填：`--sql`、`--logic-table-name`
- 测试调用：`--request-data '{"<placeholder>": "<value>", ...}'`

```bash
bytedcli oneservice api create --project-id <id> \
  --name demo_query --type script \
  --sql "SELECT user_id, country FROM dwd_user WHERE dt = #{dt}" \
  --logic-table-name dwd_user
```

---

## origin（原生式）

- 创建时只需 `--logic-table-name`，**不要传 `--sql`** —— origin API 的 SQL 由调用方在 test / invoke 时现传
- 请求体：`query_type=3`，不带 `sql` 字段
- 测试调用：`--request-data '{"Sql": "SELECT ... FROM <logic_table> WHERE ..."}'`，注意 `Sql` 是**大写 S**

```bash
bytedcli oneservice api create --project-id <id> \
  --name origin_demo --type origin --logic-table-name dwd_user

bytedcli oneservice api test --api-id 12345 \
  --request-data '{"Sql":"SELECT count(*) FROM dwd_user WHERE dt = \"2026-04-29\""}'
```

如果用户忘了在 `--request-data` 里传 `Sql`，CLI 会抛 `ONESERVICE_API_TEST_SQL_REQUIRED`。

---

## guide（向导式）

- **本 CLI 不支持创建 guide 类型 API，请走 OneService 控制面**
- 请求体需要显式的 `filter_fields[]` + `return_fields[]`，结构对应 UI 表单状态，CLI 没有暴露这两个数组的 JSON 入口
- 对控制面创建出来的 guide API，list / get / test / publish 这些只读路径仍可正常使用

---

## workflow （编排式）/ http / httpscript

CLI 不暴露 create / update 入口，请去 OneService 控制面创建。对已存在的这类 API，CLI 仍可执行 `api list` / `api get` / `api test` / `api publish`。
