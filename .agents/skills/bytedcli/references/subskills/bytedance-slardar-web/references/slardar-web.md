# Slardar Web Compatibility

Slardar Web is now part of the unified Slardar command group.

- Preferred command: `bytedcli slardar web <command>`
- Compatibility command: `bytedcli slardar-web <command>`
- Full Slardar Web / App / OS guide: `bytedance-slardar`

Existing `slardar-web` calls remain available for Web commands. New examples should use `slardar web`.

```bash
# Query Slardar Web Assistant
bytedcli slardar web query-assistant "查询bid为slardar_test，最近1天的JS错误数，按照错误信息分组"

# Analyze alarm URL
bytedcli slardar web analyze-alarm-url "<slardar-alarm-url>"

# Dashboard / Kanban
bytedcli --json slardar web dashboard list --url "https://slardar.example/node/web/kanban/detail/123456?env=production&bid=demo_bid&region=cn&lang=zh&site_type=web"
bytedcli --json slardar web dashboard get --url "https://slardar.example/node/web/kanban/detail/123456?env=production&bid=demo_bid&region=cn&lang=zh&site_type=web" --with-raw
bytedcli slardar web dashboard create --origin "https://slardar.example" --bid demo_bid --env production --site-type web --region cn --lang zh --name "demo-dashboard"
bytedcli slardar web dashboard update-name --url "https://slardar.example/node/web/kanban/detail/123456?env=production&bid=demo_bid&region=cn&lang=zh&site_type=web" --name "demo-dashboard-renamed"
bytedcli slardar web dashboard like --url "https://slardar.example/node/web/kanban/detail/123456?env=production&bid=demo_bid&region=cn&lang=zh&site_type=web"
bytedcli slardar web dashboard unlike --url "https://slardar.example/node/web/kanban/detail/123456?env=production&bid=demo_bid&region=cn&lang=zh&site_type=web"
bytedcli slardar web dashboard item add --url "https://slardar.example/node/web/kanban/detail/123456?env=production&bid=demo_bid&region=cn&lang=zh&site_type=web" --item-file ./sample-dashboard-item.json
bytedcli slardar web dashboard update --url "https://slardar.example/node/web/kanban/detail/123456?env=production&bid=demo_bid&region=cn&lang=zh&site_type=web" --items-file ./sample-dashboard-items.json --extra-file ./sample-dashboard-extra.json
bytedcli slardar web dashboard migrate --origin "https://slardar.example" --aid 123 --dashboard-detail-json '{"demo":{"bid":"demo_bid","env":"production","site_type":"web","region":"cn","lang":"zh"}}'
bytedcli slardar web dashboard migrate-hybrid-v3 --url "https://slardar.example/node/web/kanban/detail/123456?env=production&bid=demo_bid&region=cn&lang=zh&site_type=web"
bytedcli slardar web dashboard delete --url "https://slardar.example/node/web/kanban/detail/123456?env=production&bid=demo_bid&region=cn&lang=zh&site_type=web"

# Workflow Studio
bytedcli slardar web workflow list --bid <bid> --env <env> --filter-name <workflow-name>
bytedcli slardar web workflow get --bid <bid> --env <env> --flow-id <flow-id>
bytedcli slardar web workflow trigger list --bid <bid> --env <env> --workflow-name <workflow-name>
bytedcli slardar web workflow tool list

# Data Explore
bytedcli slardar web data ev-types --bid <bid> --env <env>
bytedcli slardar web data columns --bid <bid> --env <env> --ev-type <ev-type>
bytedcli slardar web data trend --bid <bid> --env <env> --ev-type <ev-type> --start-time <start-time> --end-time <end-time>
bytedcli slardar web data list --bid <bid> --env <env> --ev-type <ev-type> --start-time <start-time> --end-time <end-time> --metrics-json '["timestamp","url","session_id"]'
bytedcli slardar web data get --bid <bid> --env <env> --ev-type <ev-type> --dh-key <dh-key>
bytedcli slardar web data session-list --bid <bid> --env <env> --session-id <session-id> --start-time <start-time> --end-time <end-time>
bytedcli slardar web data event-detail --bid <bid> --env <env> --event-id <event-id> [--kind <kind>] [--start-time <start-time> --end-time <end-time>]
bytedcli slardar web data action-detail --bid <bid> --env <env> --action-id <action-id> [--start-time <start-time> --end-time <end-time>]

# Flex meta
bytedcli slardar web flex meta --bid <bid> --env <env> [--filter-label <label>] [--with-raw] [--without-row-raw]
bytedcli slardar web flex event-list --bid <bid> --env <env> [--filter-label <label>] [--with-raw] [--without-row-raw]
bytedcli slardar web flex event-measure --bid <bid> --env <env> --event-name <event-name> [--filter-label <label>] [--with-raw] [--without-row-raw]
bytedcli slardar web flex metric-related --bid <bid> --env <env> --measure-list-json '[{"measure_name":"sample.metric"}]'
bytedcli slardar web flex config get --bid <bid> --env <env> --id <analyze-id>
bytedcli slardar web flex config save --bid <bid> --env <env> --query-config-file ./sample-query-config.json
bytedcli slardar web flex query candidate --bid <bid> --env <env> --filter-name <filter-name> --request-file ./sample-request.json
bytedcli slardar web flex query series --bid <bid> --env <env> --request-file ./sample-request.json --group-by-list-json '[{"group_by_name":"sample.dimension"}]'
bytedcli slardar web flex query pie --bid <bid> --env <env> --request-file ./sample-request.json
bytedcli slardar web flex query indicator-card --bid <bid> --env <env> --request-file ./sample-request.json
bytedcli slardar web flex query pivot-table --bid <bid> --env <env> --request-file ./sample-request.json
bytedcli slardar web flex query histogram --bid <bid> --env <env> --request-file ./sample-request.json --histogram-config-list-file ./sample-histogram-config.json

# Fetch alarm history
bytedcli slardar web alarm-history --origin <slardar-origin> --bid <bid> --site-type web --rule-id <rule-id> --start-time <start-time> --end-time <end-time> --env <env>

# Start and fetch investigation
bytedcli slardar web start-investigation --history-id <history_id> --origin <slardar-origin>
bytedcli slardar web get-investigation --investigation-id <investigation_id> --origin <slardar-origin>
```

## Data Explore event drilldown

Use `data ev-types` when the event type is unknown, `data columns` to inspect fields, `data list` to fetch rows, and `data get --dh-key <dh-key>` for the selected row's full payload. Use `data session-list --session-id <session-id>` to inspect a session timeline. If the row carries `event_id` or `action_id`, use `data event-detail` or `data action-detail`, and reuse the browser's `start_time/end_time` pair when available. When mirroring a browser request, pass the captured filter tree with `--filter-conditions-json` and selected columns with `--metrics-json`.

## Dashboard workflow

For dashboard or kanban pages, prefer `dashboard get --url "<url>" --with-raw` first so the CLI can parse the page context and return the current dashboard payload. Use `dashboard update-name`, `dashboard like`, `dashboard unlike`, and `dashboard item add` for targeted edits on an existing dashboard. Use `dashboard update --items-file ... --extra-file ...` when you need to rewrite the full dashboard payload, and use `dashboard create` / `dashboard migrate` / `dashboard migrate-hybrid-v3` only for explicit create or migration tasks.

## Flex custom-event line chart

When the user asks for a Web Flex line chart over custom-event metrics such as `<event-name>/<map-key>/95分位`, follow this agent workflow:

1. Discover custom events with `flex event-list`. Use a broad contiguous `--filter-label <event-prefix>` if the full metric label is not a contiguous substring of the event label.
2. Resolve each event measure with `flex event-measure --event-name <event-name> --filter-label '<map-key>/95分位'` and keep the returned `measureName`.
3. Build a `flex query series` request with `need_time_rollup: false`, top-level `start_time`, top-level `end_time`, string `granularity` such as `"86400"`, empty `group_by_list` for an ungrouped line chart, and one `measure_list` item per requested metric.
4. For "past seven days, day-level granularity", use local start-of-day seven days ago as `start_time`, today's local start-of-day as exclusive `end_time`, and `granularity: "86400"`.
5. Validate that the response has `status: "success"`, `isAsyncPending: false`, `xAxisLength` equal to the bucket count, and `seriesCount` equal to the requested metric count.

Skeleton request:

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
          "measure_name": "{\"metric\":\"custom.metrics.pct95\",\"event_dimension\":\"event_name\",\"event_name\":\"sample_custom_event_tti\",\"map_key\":\"<map-key>\"}",
          "filter_list": [],
          "event_name": "sample_custom_event_tti"
        }
      ],
      "formula": "",
      "name": "sample_custom_event_tti/<map-key>/95分位",
      "unit": {
        "unit_type": "",
        "unit": ""
      }
    }
  ]
}
```
