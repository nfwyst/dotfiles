# TCS API 与 CLI 命令映射

`bytedcli safe tcs` 下的命令会按不同子命令访问不同 host：

- `project get`：走 Safe Queue Center（`https://safe.bytedance.net`），依赖 MPSSO 登录态
- `project update_product_type`：走 Safe Spring Meta（`https://safe.bytedance.net`），依赖 MPSSO 登录态
- `trace get`：走 TCS（`https://tcs.bytedance.net`），依赖 MPSSO 登录态

## 命令 ↔ API 映射

| CLI 命令                                                                                            | HTTP 方法 | 路径                                                                                         |
| ------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| `bytedcli safe tcs project get --project-id <id>`                                                 | `GET`   | `https://safe.bytedance.net/api/queue-center/api/v1/queue_manage/get_queue_detail?id=<id>` |
| `bytedcli safe tcs project update_product_type --project-id <id> --target-project-id <target-id>` | `POST`  | `https://safe.bytedance.net/api/spring/agw_bff/queue_center/update_project_product_type`   |
| `bytedcli safe tcs trace get --project-id <id>`                                                   | `GET`   | `/api/v2/projects/<id>/trace`                                                              |

其中 `<id>` 会在 API 层通过 URL 编码后放到 query 参数 `id` 中（仅 `project get`）；`project update_product_type` 通过 JSON body 传递。

## 请求

### project get（Safe Queue Center）

请求使用 `safeGet()`，会附带 MPSSO cookie，并包含 Safe 域常用 header（如 tenant/business）。响应为 `{ code, message, data }`，CLI 会自动解包返回 `data`。

### project update\_product\_type（Safe Spring Meta）

请求使用 `safePost()`，同样会附带 MPSSO cookie 与 Safe 域常用 header；body 采用 snake\_case 命名：

```json
{
  "projectId": "<source-project-id>",
  "targetProjectId": "<target-project-id>"
}
```

响应为 `{ code, message, data }`，CLI 会自动解包返回 `data`；非零 `code` 会抛出 `SAFE_API_ERROR`。

### trace get（TCS）

请求使用下列 header：

```
Accept: application/json
Cookie: <MPSSO session, 由 safe login 生成>
```

trace 响应若含 `{ "data": {...} }` envelope，CLI 的 parser 会自动解包；未知字段默认兜底为 `""`。

## project get 输出

project get 的 `data` 字段为“队列详情”对象，字段可能随服务端变化。CLI 文本模式会以通用 KV 表展示所有字段；`--json` 下会原样输出该对象。

| CLI 字段        | API 原始字段      | 说明                             |
| ------------- | ------------- | ------------------------------ |
| `id`          | `id`          | project id（支持 string / number） |
| `name`        | `name`        | project 名称                     |
| `description` | `description` | 描述                             |
| `ownerId`     | `owner_id`    | 所有者 id                         |
| `createdAt`   | `created_at`  | 创建时间                           |
| `updatedAt`   | `updated_at`  | 更新时间                           |

## project update\_product\_type 输出

`update_product_type` 的 `data` 字段结构由服务端决定。默认文本模式会把对象结果渲染成 KV 表；JSON 模式下会原样输出，`status` 为 `success` 表示写操作被接受。

## `TcsTrace` 字段

| CLI 字段      | API 原始字段     | 说明                           |
| ----------- | ------------ | ---------------------------- |
| `id`        | `id`         | trace id（支持 string / number） |
| `projectId` | `project_id` | 所属 project id                |
| `status`    | `status`     | trace 状态                     |
| `startTime` | `start_time` | 开始时间                         |
| `endTime`   | `end_time`   | 结束时间                         |
| `summary`   | `summary`    | 摘要                           |

## 错误码

| 错误                         | 场景                                                        |
| -------------------------- | --------------------------------------------------------- |
| `SAFE_INPUT_ERROR`         | CLI 未传 `--project-id` 或 `--target-project-id`，或相关参数为空白字符串 |
| `SAFE_API_ERROR`           | Safe 端返回非零 `code`（例如写操作鉴权失败、project 不存在等）                 |
| `401 no login`             | Safe Queue Center 返回未登录，需要 `bytedcli safe login` 重新登录     |
| `401001 no auth available` | TCS 侧 MPSSO cookie 缺失或过期，需要 `bytedcli safe login` 重新登录    |
| HTTP 4xx / 5xx             | 走 `@/utils/http` 的通用重试与错误结构，请检查内网访问与权限                    |

