# Slardar

Use `bytedcli slardar` as the unified Slardar command group:

- `slardar web`: Web / Hybrid Query Assistant, Workflow Studio, Data Explore, Flex meta, alarms, JS errors, SOP, and Investigation.
- `slardar app`: Slardar App issue logs, retrace/native stack symbolication, native symbol URLs, and log file search/download.
- `slardar os`: Slardar OS issue event summaries and main-thread native stack symbolication.

## URL routing

- `/node/app_detail/` with `#/track/logSearch/logs`: Slardar App log file search page. Use `slardar app file list --url "<url>"` to list files, or `slardar app file download --all --url "<url>" --output ./logs` to download all.
- `/node/app_detail/` with `#/abnormal/detail/`: Slardar App issue page. Use `slardar app issue log`, usually with `--symbolicate` when native stacks should be readable.
- `/node/os_detail/issue/overview/system/detail`: Slardar OS issue page. Use `slardar os issue log`, usually with `--symbolicate` when native stacks should be readable.
- Web alarm page: use `slardar web analyze-alarm-url`, then `slardar web alarm-history` and optionally `slardar web start-investigation`.
- `/node/web/kanban/detail/`: Slardar Web dashboard page. Prefer `slardar web dashboard get --url "<url>"` when the user wants one dashboard's detail, or `dashboard update-name|like|unlike|item add|update|delete|migrate-hybrid-v3 --url "<url>"` when operating on an existing dashboard. Use `dashboard create` for a new dashboard and `dashboard migrate` when the task starts from `aid + dashboard_detail`.
- Web Data Explore: use `slardar web data ev-types|columns|trend|list|get|session-list|event-detail|action-detail`. Prefer `data list` for event rows, then `data get --dh-key <dh-key>` for one row's full `metric_map/json`.

## Web / Hybrid

When the user intent indicates troubleshooting (`排查` / `排障` / `探索` / `分析`), prefer running a full Slardar Investigation chain via `alarm-history -> start-investigation -> get-investigation`.

```bash
# Query Slardar Web Assistant
bytedcli slardar web query-assistant "查询bid为slardar_test，最近1天的JS错误数，按照错误信息分组"

# Call raw alarm rule-list
bytedcli slardar web alarm-rule-list --origin <slardar-origin> --bid <bid> --site-type web

# Call raw alarm history
bytedcli slardar web alarm-history --origin <slardar-origin> --bid <bid> --site-type web --rule-id <rule-id> --start-time <start-time> --end-time <end-time> --env <env>

# Start investigation by alarm history id
bytedcli slardar web start-investigation --history-id <history_id> --origin <slardar-origin>

# Get investigation details by investigation id
bytedcli slardar web get-investigation --investigation-id <investigation_id> --origin <slardar-origin>

# Create SOP
bytedcli slardar web create-sop --bid <bid> --name <name> --runbook <runbook> --target-metric <target_metric> --origin <slardar-origin>

# Get SOP details by sop id
bytedcli slardar web get-sop --bid <bid> --sop-id <sop_id> --origin <slardar-origin>

# Analyze a Slardar alarm URL
bytedcli slardar web analyze-alarm-url "<slardar-alarm-url>"

# List dashboards from the same context as a dashboard page
bytedcli --json slardar web dashboard list --url "https://slardar.example/node/web/kanban/detail/123456?env=production&bid=demo_bid&region=cn&lang=zh&site_type=web"

# Get one dashboard and include the raw payload for follow-up edits
bytedcli --json slardar web dashboard get --url "https://slardar.example/node/web/kanban/detail/123456?env=production&bid=demo_bid&region=cn&lang=zh&site_type=web" --with-raw

# Create / rename / like / unlike a dashboard
bytedcli slardar web dashboard create --origin "https://slardar.example" --bid demo_bid --env production --site-type web --region cn --lang zh --name "demo-dashboard"
bytedcli slardar web dashboard update-name --url "https://slardar.example/node/web/kanban/detail/123456?env=production&bid=demo_bid&region=cn&lang=zh&site_type=web" --name "demo-dashboard-renamed"
bytedcli slardar web dashboard like --url "https://slardar.example/node/web/kanban/detail/123456?env=production&bid=demo_bid&region=cn&lang=zh&site_type=web"
bytedcli slardar web dashboard unlike --url "https://slardar.example/node/web/kanban/detail/123456?env=production&bid=demo_bid&region=cn&lang=zh&site_type=web"

# Add one item or rewrite the full dashboard payload
bytedcli slardar web dashboard item add --url "https://slardar.example/node/web/kanban/detail/123456?env=production&bid=demo_bid&region=cn&lang=zh&site_type=web" --item-file ./sample-dashboard-item.json
bytedcli slardar web dashboard update --url "https://slardar.example/node/web/kanban/detail/123456?env=production&bid=demo_bid&region=cn&lang=zh&site_type=web" --items-file ./sample-dashboard-items.json --extra-file ./sample-dashboard-extra.json

# Dashboard migration and cleanup
bytedcli slardar web dashboard migrate --origin "https://slardar.example" --aid 123 --dashboard-detail-json '{"demo":{"bid":"demo_bid","env":"production","site_type":"web","region":"cn","lang":"zh"}}'
bytedcli slardar web dashboard migrate-hybrid-v3 --url "https://slardar.example/node/web/kanban/detail/123456?env=production&bid=demo_bid&region=cn&lang=zh&site_type=web"
bytedcli slardar web dashboard delete --url "https://slardar.example/node/web/kanban/detail/123456?env=production&bid=demo_bid&region=cn&lang=zh&site_type=web"

# List Workflow Studio workflows
bytedcli slardar web workflow list --bid <bid> --env <env> --filter-name <workflow-name>

# Get Workflow Studio workflow detail by flow id
bytedcli slardar web workflow get --bid <bid> --env <env> --flow-id <flow-id>

# List Workflow Studio triggers by workflow internal name
bytedcli slardar web workflow trigger list --bid <bid> --env <env> --workflow-name <workflow-name>

# List Workflow Studio tool nodes
bytedcli slardar web workflow tool list

# List Data Explore event types
bytedcli slardar web data ev-types --bid <bid> --env <env>

# List Data Explore columns for an event type
bytedcli slardar web data columns --bid <bid> --env <env> --ev-type <ev-type>

# Query Data Explore trend chart
bytedcli slardar web data trend --bid <bid> --env <env> --ev-type <ev-type> --start-time <start-time> --end-time <end-time>

# List Data Explore rows and fetch one row detail
bytedcli slardar web data list --bid <bid> --env <env> --ev-type <ev-type> --start-time <start-time> --end-time <end-time> --metrics-json '["timestamp","url","session_id"]'
bytedcli slardar web data get --bid <bid> --env <env> --ev-type <ev-type> --dh-key <dh-key>

# List events in one Data Explore session timeline
bytedcli slardar web data session-list --bid <bid> --env <env> --session-id <session-id> --start-time <start-time> --end-time <end-time>

# Query legacy Data Explore detail APIs by event_id / action_id
bytedcli slardar web data event-detail --bid <bid> --env <env> --event-id <event-id> [--kind <kind>] [--start-time <start-time> --end-time <end-time>]
bytedcli slardar web data action-detail --bid <bid> --env <env> --action-id <action-id> [--start-time <start-time> --end-time <end-time>]

# List Web Flex measure categories
bytedcli slardar web flex meta --bid <bid> --env <env> [--filter-label <label>] [--with-raw] [--without-row-raw]

# List Web Flex custom events
bytedcli slardar web flex event-list --bid <bid> --env <env> [--filter-label <label>] [--with-raw] [--without-row-raw]

# List Web Flex measures for a custom event
bytedcli slardar web flex event-measure --bid <bid> --env <env> --event-name <event-name> [--filter-label <label>] [--with-raw] [--without-row-raw]

# List metric-related filters / groups / granularity
bytedcli slardar web flex metric-related --bid <bid> --env <env> --measure-list-json '[{"measure_name":"sample.metric"}]'

# Get / save a query config
bytedcli slardar web flex config get --bid <bid> --env <env> --id <analyze-id>
bytedcli slardar web flex config save --bid <bid> --env <env> --query-config-file ./sample-query-config.json

# Run chart queries
bytedcli slardar web flex query candidate --bid <bid> --env <env> --filter-name <filter-name> --request-file ./sample-request.json
bytedcli slardar web flex query series --bid <bid> --env <env> --request-file ./sample-request.json --group-by-list-json '[{"group_by_name":"sample.dimension"}]'
bytedcli slardar web flex query pie --bid <bid> --env <env> --request-file ./sample-request.json
bytedcli slardar web flex query indicator-card --bid <bid> --env <env> --request-file ./sample-request.json
bytedcli slardar web flex query pivot-table --bid <bid> --env <env> --request-file ./sample-request.json
bytedcli slardar web flex query histogram --bid <bid> --env <env> --request-file ./sample-request.json --histogram-config-list-file ./sample-histogram-config.json

# List pending JS errors
bytedcli slardar web js-error-list --bid <bid> --env <env> --start-time <start-time> --end-time <end-time> --origin <slardar-origin>

# Get JS error issue detail by issue id
bytedcli slardar web js-error-issue-detail --bid <bid> --env <env> --issue-id <issue-id> --start-time <start-time> --end-time <end-time> --origin <slardar-origin>

# Get JS error issue stack by issue id and release
bytedcli slardar web js-error-issue-stack --bid <bid> --env <env> --issue-id <issue-id> --release <release> --start-time <start-time> --end-time <end-time> --origin <slardar-origin> [--raw-only|--sourcemap-only]

# Analyze a Slardar alarm URL and return structured JSON for agent composition
bytedcli --json slardar web analyze-alarm-url "<slardar-alarm-url>"
```

### Web Data Explore event drilldown

Use this workflow when the user has a Slardar Web Data Explore page or browser request and wants the same data from CLI.

1. Capture the page request body and copy `common.bid`, `common.env`, `common.site_type`, `time_filter`, `ev_type`, `filter_conditions`, and selected metrics.
2. Use `data ev-types` when the event type is unknown, then `data columns --ev-type <ev-type>` to resolve selectable fields.
3. Run `data list` with the captured time window and filters. Use `--metrics-json` for selected columns and `--filter-conditions-json` for the browser filter tree.
4. Extract `dhKey` from the returned rows and call `data get --ev-type <ev-type> --dh-key <dh-key>` for full row details.
5. If the row has a `session_id`, call `data session-list --session-id <session-id>` with the same time window to reconstruct the session timeline.
6. If the row exposes `event_id` or `action_id`, call `data event-detail` or `data action-detail`; when the UI request already carries a time window, pass the same `start_time/end_time` pair to avoid cross-window ambiguity.

Text mode prints compact summaries. Use `--json` for structured output, and add `--with-raw` only when the caller needs the top-level Slardar payload.

### Web dashboard workflow

Use this workflow when the user gives a Slardar dashboard page and wants to inspect or edit the dashboard from CLI.

1. Start with `dashboard get --url "<url>" --with-raw` to confirm the parsed dashboard context and capture the current payload.
2. For lightweight changes on an existing dashboard, prefer `dashboard update-name`, `dashboard like`, `dashboard unlike`, or `dashboard item add` with the same `--url`.
3. For full dashboard rewrites, export the raw `items` array and optional `extra` from `dashboard get --with-raw`, then pass them back with `dashboard update --items-file ... --extra-file ...`.
4. For create flows, use `dashboard create --origin <slardar-origin> --bid <bid> --env <env> --site-type <site-type>` and keep `--region` / `--lang` aligned with the target dashboard page.
5. For migration flows, use `dashboard migrate` when you already have `aid + dashboard_detail`, and use `dashboard migrate-hybrid-v3 --url "<url>"` when migrating an eligible existing dashboard.

### Web Flex custom-event line chart

Use this workflow when the user asks for a Web Flex line chart over custom events, for example two custom TTI metrics such as `<event-name>/<map-key>/95分位`, a fixed `bid/env`, a recent time range, and day-level granularity.

1. Discover candidate custom events with a broad contiguous label filter. If the exact metric text contains separated tokens, search by a stable event prefix instead of the full display label.

```bash
bytedcli --json slardar web flex event-list \
  --bid <bid> \
  --env <env> \
  --filter-label <event-prefix> \
  --without-row-raw
```

2. Resolve each event's measure name. For a `95分位` custom metric under map key `<map-key>`, filter by `<map-key>/95分位` and capture the returned `measureName`.

```bash
bytedcli --json slardar web flex event-measure \
  --bid <bid> \
  --env <env> \
  --event-name sample_custom_event_tti \
  --filter-label '<map-key>/95分位' \
  --without-row-raw
```

For percentile custom-event metrics, the returned `measureName` is typically a JSON string shaped like:

```jsonc
{"metric":"custom.metrics.pct95","event_dimension":"event_name","event_name":"sample_custom_event_tti","map_key":"<map-key>"}
```

Prefer the API-returned `measureName` over hand-written values whenever possible.

3. Build a Flex series request. Use Unix seconds for `start_time` and `end_time`. For "past seven days, day-level granularity", use the local timezone's start of day seven days ago as `start_time`, today's start of day as exclusive `end_time`, and `granularity: "86400"`.

```jsonc
{
  "need_time_rollup": false,
  "start_time": <start-time-sec>,
  "end_time": <end-time-sec>,
  "granularity": "86400",
  "cond_settings": {
    "exclude_null": "false"
  },
  "group_by_list": [],
  "time_shift_list": [],
  "filter_list": [],
  "measure_list": [
    {
      "type": "monomial",
      "raw_measure_list": [
        {
          "measure_name": "{\"metric\":\"custom.metrics.pct95\",\"event_dimension\":\"event_name\",\"event_name\":\"sample_custom_event_a_tti\",\"map_key\":\"<map-key>\"}",
          "filter_list": [],
          "event_name": "sample_custom_event_a_tti"
        }
      ],
      "formula": "",
      "name": "sample_custom_event_a_tti/<map-key>/95分位",
      "unit": {
        "unit_type": "",
        "unit": ""
      }
    },
    {
      "type": "monomial",
      "raw_measure_list": [
        {
          "measure_name": "{\"metric\":\"custom.metrics.pct95\",\"event_dimension\":\"event_name\",\"event_name\":\"sample_custom_event_b_tti\",\"map_key\":\"<map-key>\"}",
          "filter_list": [],
          "event_name": "sample_custom_event_b_tti"
        }
      ],
      "formula": "",
      "name": "sample_custom_event_b_tti/<map-key>/95分位",
      "unit": {
        "unit_type": "",
        "unit": ""
      }
    }
  ]
}
```

4. Run the line-chart query. Prefer `--request-file` for long payloads; use `--request-json` when the caller needs a single command.

```bash
bytedcli --json slardar web flex query series \
  --bid <bid> \
  --env <env> \
  --request-file ./sample-flex-series-request.json
```

```bash
bytedcli --json slardar web flex query series \
  --bid <bid> \
  --env <env> \
  --request-json '{"need_time_rollup":false,"start_time":<start-time-sec>,"end_time":<end-time-sec>,"granularity":"86400","cond_settings":{"exclude_null":"false"},"group_by_list":[],"time_shift_list":[],"filter_list":[],"measure_list":[{"type":"monomial","raw_measure_list":[{"measure_name":"{\"metric\":\"custom.metrics.pct95\",\"event_dimension\":\"event_name\",\"event_name\":\"sample_custom_event_a_tti\",\"map_key\":\"<map-key>\"}","filter_list":[],"event_name":"sample_custom_event_a_tti"}],"formula":"","name":"sample_custom_event_a_tti/<map-key>/95分位","unit":{"unit_type":"","unit":""}},{"type":"monomial","raw_measure_list":[{"measure_name":"{\"metric\":\"custom.metrics.pct95\",\"event_dimension\":\"event_name\",\"event_name\":\"sample_custom_event_b_tti\",\"map_key\":\"<map-key>\"}","filter_list":[],"event_name":"sample_custom_event_b_tti"}],"formula":"","name":"sample_custom_event_b_tti/<map-key>/95分位","unit":{"unit_type":"","unit":""}}]}'
```

5. Validate the response before summarizing it to the user: `status` should be `success`, `isAsyncPending` should be false, `xAxisLength` should match the expected bucket count, and `seriesCount` should match the requested metric count. Use `data.series[].data` for the full point arrays and `seriesRows[]` for compact labels, point counts, averages, and sums.

## App issue logs and symbolication

Use `issue log` to fetch the event detail/log from a Slardar App issue URL:

```bash
bytedcli --json slardar app issue log \
  --url "https://slardar.example/node/app_detail/?region=cn&aid=123&os=Android&type=app&lang=zh#/abnormal/detail/crash/demo_issue?params=%7B%22start_time%22%3A1773410940%2C%22end_time%22%3A1776089340%2C%22event_index%22%3A1%7D"
```

The URL parser reads:

- outer query: `region`, `aid`, `os`, `lang`
- hash route: `/abnormal/detail/<crash_type>/<issue_id>`
- `params` JSON: `start_time`, `end_time`, `event_index`, `token`, `token_type`, `crash_time_type`, `granularity`, `filters_conditions`

When the URL contains `params.event_index`, bytedcli uses it to select the matching event before fetching the log.

Use `issue log --symbolicate` when the user wants the original native stack from an App issue URL:

```bash
bytedcli --json slardar app issue log --symbolicate \
  --url "https://slardar.example/node/app_detail/?region=cn&aid=123&os=Android&type=app&lang=zh#/abnormal/detail/crash/demo_issue?params=%7B%22start_time%22%3A1773410940%2C%22end_time%22%3A1776089340%2C%22event_index%22%3A1%7D"
```

Useful options:

- `--include-lib librvm.so`: only symbolize frames from one library.
- `--max-frames 6`: cap the number of frames.
- `--output-dir ./symbols`: override the local fallback symbol cache directory.
- `--force-download`: refresh cached `.zst` and `.so` files during local fallback.
- `--addr2line-path <path>` and `--zstd-path <path>`: provide explicit local fallback tool paths.

The command calls Slardar App retrace first. If retrace is unavailable or returns no symbolicated native frames, it falls back to downloading native symbols locally. The local fallback uses `crash_lib_uuid` from the event log when available; if that mapping is missing, it falls back to converting the native stack `BuildId` into a Slardar symbol uuid.

Generate a native symbol URL:

```bash
bytedcli slardar app symbol url --build-id 00112233445566778899aabbccddeeff00112233
bytedcli slardar app symbol url --uuid 33221100554477660
```

The native symbol URL uses these defaults unless the caller overrides them:

```text
origin=<built-in Slardar App origin>
type=Native
os=Android
aid=13
update_version_code=3
region=cn
```

## App log file search and download

Use `file list` to search log files by device ID:

```bash
bytedcli --json slardar app file list \
  --aid 123 --os Android --region cn \
  --device-id demo_device \
  --start-time 1776092520 --end-time 1776351720
```

The URL parser reads (`--url` is also supported):

- outer query: `aid`, `os`, `region`, `lang`
- hash JSON after `#/track/logSearch/logs?`: `device_id` (or `uid`), `start_time`, `end_time`

Filter options: `--scene`, `--log-type`, `--merge <0|1>`, `--page-no`, `--page-size`.

Use `file range` to query available filter dimension values:

```bash
bytedcli --json slardar app file range \
  --aid 123 --os Android --region cn \
  --device-id demo_device \
  --start-time 1776092520 --end-time 1776351720 \
  --dimension scene
```

Use `file download` to download a single file (the first match):

```bash
bytedcli slardar app file download \
  --aid 123 --os Android --region cn \
  --device-id demo_device \
  --start-time 1776092520 --end-time 1776351720 \
  --output ./demo.alog.hot
```

Use `file download --all` to download all files to a directory:

```bash
bytedcli slardar app file download --all \
  --aid 123 --os Android --region cn \
  --device-id demo_device \
  --start-time 1776092520 --end-time 1776351720 \
  --output ./logs
```

With `--all`, each file is downloaded individually to the `--output` directory (defaults to `./slardar_logs`). Duplicate file names are automatically deduplicated with a numeric suffix.

## OS issue event summary and symbolication

Use `issue log` to fetch the selected Slardar OS issue event from a URL:

```bash
bytedcli --json slardar os issue log \
  --url "https://slardar.example/node/os_detail/issue/overview/system/detail?app_id=123&start_time=1775491200&end_time=1776133985&region=cn&category=3&time_type=client_time&filter_conditions=%257B%2522type%2522%253A%2522and%2522%252C%2522sub_conditions%2522%253A%255B%255D%257D&issue_id=demo_issue&pgno=1"
```

The URL parser reads:

- path: `/node/os_detail/issue/overview/system/detail`
- query: `app_id`, `region`, `issue_id`, `category`, `time_type`, `start_time`, `end_time`, `pgno` or `page_num`
- query: `filter_conditions`, including double-encoded JSON from the Slardar OS UI

The command calls:

```text
POST <origin>/api_v2/os/event/list?lang=<lang>
```

`page_size` defaults to `1`. Text output prints event metadata and the extracted main thread stack. JSON output returns the selected event, the original request body, and `mainThreadStack`.

Use `issue log --symbolicate` when the user wants readable native symbols from a Slardar OS issue:

```bash
bytedcli --json slardar os issue log --symbolicate \
  --url "https://slardar.example/node/os_detail/issue/overview/system/detail?app_id=123&start_time=1775491200&end_time=1776133985&region=cn&category=3&time_type=client_time&filter_conditions=%257B%2522type%2522%253A%2522and%2522%252C%2522sub_conditions%2522%253A%255B%255D%257D&issue_id=demo_issue&pgno=1" \
  --max-frames 20
```

Useful options:

- `--include-lib <name>`: only symbolize frames matching a library path/name, BuildID, or `offset:<apk-offset>`.
- `--max-frames <n>`: cap the number of native frames.
- `--output-dir ./symbols`: override the local symbol cache directory.
- `--force-download`: refresh cached `.zst` and decompressed symbol files.
- `--addr2line-path <path>` and `--zstd-path <path>`: provide explicit local tool paths.
- `--update-version-code <code>`: override the Slardar native symbol download `update_version_code`.

For APK embedded native frames, bytedcli groups symbolication by `BuildId + APK offset`. The native symbol implementation is shared with Slardar App: BuildID is converted to the Slardar symbol uuid, the `.zst` symbol file is downloaded through the native mapping endpoint, then `llvm-addr2line` resolves the requested PCs.

If one symbol group fails to download or symbolize, bytedcli records those frames under `unresolvedFrames` and continues with the other groups.
