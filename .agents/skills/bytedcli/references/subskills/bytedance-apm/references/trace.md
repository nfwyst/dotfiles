# Argos Trace Search (`apm argos trace`)

Three commands wrapping `bytedtrace.byted.org/trace_api/v2/trace/query_obj_list`
(main search) and `/trace_api/v1/meta/*` (discovery), authenticated with the
Bytecloud JWT from `cloud.bytedance.net`.

## When to use

- User asks to "search traces" / "找一下出错的 trace" / "找 ee.kunlun.datax 上一小时 5xx" / referencing the Argos page `/argos/trace/retrieve/conditionRetrieve`.
- User pastes a `bytedtrace.byted.org/trace_api/v2/trace/query_obj_list` curl.

For _single-trace expansion_ (`/trace_api/v2/trace/query_transactions`,
`query_trace_tree`) this skill is **not** the right entry — those live under
`log` today and remain unchanged.

## Commands

### `bytedcli apm argos trace search`

Required:

- `--psm <psm>` — service PSM.

Time window (either pair):

- `--from <epoch> --to <epoch>` — both required together; `--to > --from`.
- `--duration <d>` — relative window, e.g. `10m`, `1h`, `30s`. Default `10m` when neither pair is given.

Scope:

- `--category` (default `span`), `--type` (default `server`), `--view-point` (default empty; `callee` etc.).
- `--metrics-region` — defaults to `cn` for `cn`/`boe` sites, `sg` for `i18n-tt`.
- `--only-normal-trace` / `--no-only-normal-trace` — default true.
- `--desc` — sort by timestamp descending.
- `--page-size <n>` — 1..100, default 10.

Filters (JSON pass-through, AI-friendly):

- `--filter-tags-json '[{"tag_key":"_is_error","values":["true"],"data_type":"BOOL","is_range_query":false}]'`
- `--filter-tags-file <path>`

`data_type` accepts `STRING` (default) / `INT` / `LONG` / `BOOL`. `is_range_query` defaults to `false`.

Pagination:

- `--page-token <token>` — pass back the `next_page_token` (base64 cursor) from a previous response.

### `bytedcli apm argos trace categories --psm <psm>`

Returns the `(category, type, view_point)` combinations available for the PSM, plus their supported metrics. Use before search if unsure which `--category/--type` to pass.

### `bytedcli apm argos trace dimensions --psm <psm> --category <c> --type <t> [--view-point <v>]`

Returns the filter dimensions for that combo: `tag_key`, `tag_data_type`, `tag_display_name`, `is_range_query_tag`, `values` previews. Use before search to pick valid `tag_key` and the correct `data_type`.

## JSON output shape (search)

```json
{
  "status": "success",
  "data": {
    "items": [
      /* raw span objects from backend, untouched */
    ],
    "next_page_token": "eyJQcmVPZmZzZXQiOjEwfQ==",
    "request": {
      /* the body the CLI actually posted */
    }
  }
}
```

`next_page_token` is always present in the response (never null when more pages remain). The backend does not return `total`. To continue paging, call the same command with `--page-token <next_page_token>`.

## Typical AI usage

1. `bytedcli --json apm argos trace categories --psm example.demo.api` → pick `(category, type)`.
2. `bytedcli --json apm argos trace dimensions --psm example.demo.api --category span --type server` → discover `tag_key` + `data_type` for the filter you want.
3. `bytedcli --json apm argos trace search --psm example.demo.api --duration 10m --filter-tags-json '[{"tag_key":"_is_error","values":["true"],"data_type":"BOOL"}]' --page-size 20` → run the search.

## Common pitfalls

- 仅 `cn / boe / i18n-tt` 三个 site 经过验证。其它 site（`i18n` / `i18n-bd` / `eu-ttp` / `us-ttp*`）会被显式 `CLI_INPUT_ERROR` 拒绝，理由是 bytedtrace 后端 host 与 ByteCloud JWT origin 的三元组对应关系尚未抓包验证，避免静默回退到错域名/错租户。若你确实需要这些 site，先在线下抓包确认 host + JWT issuer，再扩 `BYTEDTRACE_HOST_BY_SITE` + 补一条对应的离线测试。
- `metrics_region` 默认值：cn / boe → `"cn"`，i18n-tt → `"sg"`。需要查别的 vregion 时显式 `--metrics-region`。
- `--from/--to` and `--duration` are mutually exclusive — passing both is an input error.
- Backend is strict about `data_type`: passing `_is_error=true` with `data_type=STRING` may return zero rows. Always look up the real `data_type` via `dimensions` (or trust UI exports verbatim).
- The UI's `only_completed_trace` URL param is the same as the body's `only_normal_trace`. Use `--only-normal-trace` / `--no-only-normal-trace`.
