---
name: bytedance-byteio
description: "Operate ByteIO via bytedcli: query event schema/detail, check event parameters, list and inspect requirements, BTM points, test cases, location attributes, location events, ad tags/labels, and run the Authorization-based requirement/event write workflow (`byteio flow run`). Use when tasks mention ByteIO, 埋点, event tracking, event_name, schema/detail, 需求, 点位, BTM, 测试用例, 广告 tag/label, or ByteIO 导入写入链路。"
---

# bytedcli ByteIO

Use this skill for ByteIO event tracking metadata and governance queries, plus the requirement/event write workflow.

## When to use

- 用户要确认某个埋点、事件名或 `event_name` 是否存在，或查看单个埋点元数据详情
- 用户要校验埋点参数是否匹配 ByteIO schema
- 用户要查询 ByteIO 需求列表、需求详情、需求中的点位列表
- 用户要查询 BTM 点位详情、业务线下点位、点位上的埋点
- 用户要查询测试用例信息列表、测试用例详情
- 用户要查询广告 tag / label，或按用户邮箱前缀查询埋点信息
- 用户要在 ByteIO 中创建需求并录入技术埋点事件
- 用户要执行 `byteio flow run`

## Authentication

ByteIO OpenAPI query commands require an `authorization` header. Configure it through an environment variable before running query/read commands:

```bash
export BYTEDCLI_BYTEIO_AUTHORIZATION=<byteio-openapi-authorization>
```

ByteIO flow write commands use the same `authorization` header as ByteIO query/read commands:

```bash
export BYTEDCLI_BYTEIO_AUTHORIZATION=<byteio-openapi-authorization>
```

Do not print or persist authorization/session secrets in summaries, docs, fixtures, or examples.

## Common options

- `--region cn|sg`: ByteIO OpenAPI region. Default: `cn`.
- `--body-json <json>`: supported by POST commands to merge extra request body fields from the API document.
- `--json`: global bytedcli flag. Put it before the command, for example `bytedcli --json byteio event get ...`.

## Command map

```bash
# 查询单个埋点元数据详情
bytedcli byteio event get --app-id 123 --event-name demo_event
bytedcli byteio event get --app-id 123 --event-name demo_event --include-scene

# 校验埋点参数
bytedcli byteio event check-params \
  --app-id-list 123 \
  --event-name-list demo_event \
  --param-name-list demo_param

bytedcli byteio event check-params \
  --checks-json '[{"app_id_list":[123],"event_name_list":["demo_event"],"param_name_list":["*"]}]'

# 根据用户邮箱前缀查询埋点信息
bytedcli byteio event list --owner demo.user

# 查询需求列表 / 详情 / 需求中的点位列表
bytedcli byteio requirement list --app-id 123 --keyword demo --page 1 --page-size 50
bytedcli byteio requirement get --requirement-id 456
bytedcli byteio requirement locations --app-id 123 --requirement-id 456

# 查询 BTM 点位详情
bytedcli byteio btm point get --operator demo.user --requirement-id 456
bytedcli byteio btm point get --operator demo.user --requirement-id 456 --btm-full-code-list demo.point

# 查询测试用例信息列表 / 详情
bytedcli byteio test-case list --app-id 123 --event-name demo_event --page 1 --page-size 20
bytedcli byteio test-case get --test-case-id demo-case-id

# 根据业务线查询点位；根据点位查询点位上的埋点
bytedcli byteio map locations --app-id 123 --business-module-ids 1,2
bytedcli byteio map events --app-id 123 --full-identifier-list demo.page.button

# 查询广告 tag / label
bytedcli byteio ad tags
bytedcli byteio ad labels
```

## Existence checks

For "埋点是否存在" tasks, prefer:

```bash
bytedcli --json byteio event get --app-id 123 --event-name demo_event
```

Interpretation:

- `exists: true`: request succeeds and the response contains non-empty schema/detail data.
- `exists: false`: response clearly indicates empty data or not found.
- `exists: unknown`: authorization, permission, network, timeout, non-JSON, or unclear business errors.

Always report `app_id`, `event_name`, existence, and concise response evidence. Do not include the authorization value.

## Flow write workflow

```bash
# 本地 JSON 全链路（创建需求 -> 在该需求下批量创建事件）
BYTEDCLI_BYTEIO_AUTHORIZATION=<token> \
bytedcli byteio flow run \
  --app-id 1128 \
  --requirement-payload-json '{"name":"byteio-demo","description":"需求备注","sync_app_ids":[1128],"os":["android","ios"],"owners":["demo.user"],"involved_employee":["review.user"]}' \
  --events-json '[{"event_name":"demo_event","trigger_type":"tech","description":"描述","category":"business"}]'

# dry-run 只做校验和归一化，不发请求
BYTEDCLI_BYTEIO_AUTHORIZATION=<token> \
bytedcli byteio flow run \
  --app-id 1128 \
  --requirement-payload-json '{"name":"byteio-demo","sync_app_ids":[1128],"os":["android"],"owners":["demo.user"],"involved_employee":["review.user"]}' \
  --events-json '{"creator":"demo.user","events":[{"event_name":"demo_event","trigger_type":"tech","description":"描述","category":"business"}]}' \
  --dry-run
```

Notes:

- `flow run` 使用 JSON 输入创建需求并批量录入事件。
- 创建链路为：先调 `POST /byteio/open/v1/requirements`，再调当前 region 对应的 `/service/available` 获取 `requirement:import_event_v2` 的 `url`，拼接成完整 URL 后以原请求体调用 `event_records?requirement_id=...` 批量创建需求内埋点。
- requirement v1 请求体按 `name`、`description`、`sync_app_ids`、`os`、`owners`、`involved_employee` 组织；响应需求 ID 在 `data.id`。
- `--events-json` 的最小事件字段为 `event_name`、`trigger_type`、`description`、`category`；`trigger_type` 取值范围为 `click/show/stay/slide/play/page_view/result/tech`。可选字段包括 `cost_business_line_name`、`image_urls`、`tags`、`business_module_id`、`scenes`、`remark`、`params`。兼容输入别名 `name -> event_name`。
- `params` 中 `param_data_type` 仅支持 `string` / `integer` / `float` / `boolean`；`param_type` 仅支持 `ordinary` / `enum` / `range`；`is_required` 支持 `0/1`（字符串或数字）及布尔值输入。
- `--events-json` 支持数组、单对象，以及包装对象里的 `events` / `event_records`；`schemas` 可作为兼容别名读取。
- `sync_app_ids` 会自动补齐当前 `--app-id`。
- `creator`、`product_owners`、`develop_owners`、`test_owners` 不属于当前 requirement v1 请求模型；若输入这些旧字段，CLI 会在新链路中剔除。
- 批量创建接口失败时，会为本批次中的每个事件生成 retry list。
- 成功输出会汇总 `requirementId`、`createdCount`、`failedCount`、`failures`、`batchEventResponse`；`failures[]` 内含 `index`、`event_name`、`code`、`message`。
- 当没有 `BYTEDCLI_BYTEIO_AUTHORIZATION` 时，会返回 `BYTEIO_AUTH_REQUIRED`；先设置环境变量后重试。

## References

- `references/byteio.md`
- `references/invocation.md`
- `references/troubleshooting.md`
