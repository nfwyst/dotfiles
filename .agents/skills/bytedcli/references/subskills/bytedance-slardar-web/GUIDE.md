---
name: bytedance-slardar-web
description: "Compatibility skill for Slardar Web. Use bytedance-slardar for the unified Slardar tooling; existing Slardar Web tasks such as alarm pages, dashboard or kanban pages, Workflow Studio, Data Explore, Flex, JS error triage, and SOP / Investigation should route to bytedcli slardar web commands. The legacy bytedcli slardar-web command still works as a compatibility entry."
---

# bytedcli Slardar Web Compatibility

Slardar Web is now part of the unified Slardar skill and command group.

- Prefer `bytedance-slardar`.
- Prefer `bytedcli slardar web <command>`.
- `bytedcli slardar-web <command>` remains available only as a compatibility command.

## Quick migration

```bash
bytedcli slardar web query-assistant "查询bid为slardar_test，最近1天的JS错误数，按照错误信息分组"
bytedcli slardar web alarm-rule-list --origin <slardar-origin> --bid <bid> --site-type web
bytedcli slardar web alarm-history --origin <slardar-origin> --bid <bid> --site-type web --rule-id <rule-id> --start-time <start-time> --end-time <end-time> --env <env>
bytedcli slardar web analyze-alarm-url "<slardar-alarm-url>"
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
bytedcli slardar web start-investigation --history-id <history_id> --origin <slardar-origin>
bytedcli slardar web get-investigation --investigation-id <investigation_id> --origin <slardar-origin>
bytedcli slardar web create-sop --bid <bid> --name <name> --runbook <runbook> --target-metric <target_metric> --origin <slardar-origin>
bytedcli slardar web get-sop --bid <bid> --sop-id <sop_id> --origin <slardar-origin>
bytedcli slardar web workflow list --bid <bid> --env <env> --filter-name <workflow-name>
bytedcli slardar web workflow get --bid <bid> --env <env> --flow-id <flow-id>
bytedcli slardar web workflow trigger list --bid <bid> --env <env> --workflow-name <workflow-name>
bytedcli slardar web workflow tool list
bytedcli slardar web data ev-types --bid <bid> --env <env>
bytedcli slardar web data columns --bid <bid> --env <env> --ev-type <ev-type>
bytedcli slardar web data trend --bid <bid> --env <env> --ev-type <ev-type> --start-time <start-time> --end-time <end-time>
bytedcli slardar web data list --bid <bid> --env <env> --ev-type <ev-type> --start-time <start-time> --end-time <end-time> --metrics-json '["timestamp","url","session_id"]'
bytedcli slardar web data get --bid <bid> --env <env> --ev-type <ev-type> --dh-key <dh-key>
bytedcli slardar web data session-list --bid <bid> --env <env> --session-id <session-id> --start-time <start-time> --end-time <end-time>
bytedcli slardar web data event-detail --bid <bid> --env <env> --event-id <event-id> [--kind <kind>] [--start-time <start-time> --end-time <end-time>]
bytedcli slardar web data action-detail --bid <bid> --env <env> --action-id <action-id> [--start-time <start-time> --end-time <end-time>]
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
bytedcli slardar web js-error-list --bid <bid> --env <env> --start-time <start-time> --end-time <end-time> --origin <slardar-origin>
bytedcli slardar web js-error-issue-detail --bid <bid> --env <env> --issue-id <issue-id> --start-time <start-time> --end-time <end-time> --origin <slardar-origin>
bytedcli slardar web js-error-issue-stack --bid <bid> --env <env> --issue-id <issue-id> --release <release> --start-time <start-time> --end-time <end-time> --origin <slardar-origin> [--raw-only|--sourcemap-only]
```

## Flex Series Workflow

For custom-event line charts such as `<event-name>/<map-key>/95分位`, use `event-list` to discover events, `event-measure` to resolve each API `measureName`, then call `flex query series` with top-level `start_time`, `end_time`, and string `granularity`. The detailed reusable workflow lives in `bytedance-slardar` under `references/slardar.md` section "Web Flex custom-event line chart".

## Data Explore Workflow

For Data Explore rows, use `data list` with the page's `bid/env/ev_type/time_filter/filter_conditions`, then use the returned `dhKey` with `data get` for full `metric_map/json`. Use `data columns` to resolve available metrics, `data session-list` when the row has a `session_id`, and `data event-detail` / `data action-detail` when the payload contains `event_id` or `action_id` for the legacy detail APIs.

## Dashboard Workflow

For dashboard or kanban pages (`/node/web/kanban/detail/...`), prefer `dashboard get --url "<url>" --with-raw` first so the CLI parses `dashboard_id / bid / env / site_type / region / lang` from the URL. Use `dashboard update-name`, `dashboard like`, `dashboard unlike`, `dashboard item add`, or `dashboard update` for edits on the existing dashboard. Use `dashboard create` for a new dashboard, and use `dashboard migrate` / `dashboard migrate-hybrid-v3` only when the task is explicitly a migration.

## References

- `bytedance-slardar`
- `references/slardar-web.md`
