---
name: bytedance-slardar
description: "Use bytedcli for Slardar tooling across Web, App, and OS. Trigger when tasks mention Slardar alarm pages, Web/Hybrid Query Assistant, Web dashboard or kanban pages, JS error triage, Slardar App issue links, app crash/anr/native stack logs, retrace, Android .so BuildID/crash_lib_uuid/native symbol URL, Slardar App log file search/download (#/track/logSearch), Slardar OS issue links, /node/os_detail pages, system ANR/native stacks, or symbolizing Slardar App/OS native stack frames."
---

# bytedcli Slardar

## 如何调用 bytedcli

先选择一种调用方式。下面所有示例默认直接写 `bytedcli`。

```bash
# 方式 1：直接用 npx 运行最新版
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]

# 方式 2：先全局安装，再直接调用 bytedcli
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli <command> [options]
```

- 使用 `npx` 时，把后文示例里的 `bytedcli` 替换成 `NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest`
- 已全局安装时，直接按后文示例执行 `bytedcli ...`

## When to use

- Slardar Web / Hybrid 查询、Dashboard / Kanban、Workflow Studio、Data Explore、Flex 元数据、告警规则、告警历史、JS error issue、SOP 与 Investigation。
- Slardar App issue URL、事件日志、Slardar retrace、native 栈符号化、native symbol URL。
- Slardar App 日志文件检索（`#/track/logSearch/logs`）：按设备 ID 列出、筛选、下载日志文件。
- Slardar OS issue URL、事件 summary、main thread stack、APK embedded native stack 符号化。
- 用户只贴 Slardar URL 时，先按 URL path 区分 `web`、`app`、`os` 子命令。

## Command layout

- Web: `bytedcli slardar web <command>`
- App: `bytedcli slardar app <command>`
- OS: `bytedcli slardar os <command>`

## URL routing

- App log file search URL containing `#/track/logSearch/logs`: use `bytedcli --json slardar app file list --url "<url>"` to list log files, or `bytedcli slardar app file download --all --url "<url>" --output ./logs` to download all files.
- App issue URL containing `/node/app_detail/`: use `bytedcli --json slardar app issue log --symbolicate --url "<url>"` when the user wants readable native stacks; omit `--symbolicate` when they only want the raw event log.
- OS issue URL containing `/node/os_detail/issue/overview/system/detail`: use `bytedcli --json slardar os issue log --symbolicate --url "<url>"` when the user wants readable native stacks; omit `--symbolicate` when they only want the event summary.
- Web alarm URL: use `bytedcli --json slardar web analyze-alarm-url "<url>"`, then fetch alarm history and optionally start an investigation.
- Web dashboard URL containing `/node/web/kanban/detail/`: use `bytedcli --json slardar web dashboard get --url "<url>"` to inspect one dashboard, or `slardar web dashboard list|get|create|update-name|like|unlike|item add|update|delete|migrate|migrate-hybrid-v3` for dashboard management. Prefer `--url` for existing dashboards so the CLI can parse `dashboard_id / bid / env / site_type / region / lang` from the page URL.
- Web JS error tasks: use `slardar web js-error-list`, `slardar web js-error-issue-detail`, or `slardar web js-error-issue-stack`.
- Web Workflow Studio tasks: use `slardar web workflow list|get`, `slardar web workflow trigger list`, or `slardar web workflow tool list`.
- Web Data Explore tasks: use `slardar web data ev-types|columns|trend|list|get|session-list`. Prefer `data list` for event rows and `data get --dh-key <dh-key>` for the full `metric_map/json` of one row. Use `--filter-conditions-json`, `--metrics-json`, `--dh-keys-json`, and `--request-json` when mirroring a browser request.
- Web Flex meta tasks: use `slardar web flex meta`, `slardar web flex event-list`, `slardar web flex event-measure`, or `slardar web flex metric-related`; add `--filter-label` to narrow local output by display label. In JSON mode, top-level `raw` is off by default for meta commands; use `--with-raw` to include it and `--without-row-raw` to trim row-level `raw`.
- Web Flex query-config tasks: use `slardar web flex config get` / `save`. `config save` reads `--query-config` / `--query-config-file` as the base config, then applies high-frequency overrides such as `--start-time` / `--end-time` / `--measure-list-json`.
- Web Flex chart queries: use `slardar web flex query candidate|series|pie|indicator-card|pivot-table|histogram`. Prefer `--request-json` / `--request-file` for the full body, then use override flags like `--group-by-list-json`, `--topn-json`, `--time-shift-list-json`, `--cond-settings-json`, `--long-term-options-json`, and `--histogram-config-list-json` when only a few top-level fields need to change. For custom-event line charts, load `references/slardar.md` and follow "Web Flex custom-event line chart".

## Investigation policy

If the user intent matches any of these keywords: `排查`, `排障`, `探索`, `分析`, prefer triggering a Slardar Investigation for Web alarm tasks via `slardar web start-investigation`.

Recommended ways to obtain `history_id`:

1. If the user provides a Slardar alarm page URL, run `slardar web analyze-alarm-url` to extract `rule_id / bid / site_type / time window`, then run `slardar web alarm-history` and choose a suitable `history_id`.
2. If the user provides `origin + bid + rule_id + start_time + end_time (+ env)`, directly run `slardar web alarm-history`.
3. If neither path has enough data, ask for `history_id`, the alarm page URL, or the rule/time window.

Then run:

```bash
bytedcli slardar web start-investigation --history-id <history_id> --origin <slardar-origin>
bytedcli slardar web get-investigation --investigation-id <investigation_id> --origin <slardar-origin>
```

After `get-investigation`, read `status`. If it is `ongoing`, tell the user it is still running. If `sop_data` is present, parse it and check `is_default`: official SOPs can be mentioned without custom SOP links; custom SOPs can include the SOP link.

## Quick start

```bash
# Web / Hybrid
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
bytedcli slardar web flex meta --bid <bid> --env <env> [--filter-label <label>] [--with-raw] [--without-row-raw]
bytedcli slardar web flex event-list --bid <bid> --env <env> [--filter-label <label>] [--with-raw] [--without-row-raw]
bytedcli slardar web flex event-measure --bid <bid> --env <env> --event-name <event-name> [--filter-label <label>] [--with-raw] [--without-row-raw]
bytedcli slardar web flex metric-related --bid <bid> --env <env> --measure-list-json '[{"measure_name":"sample.metric"}]'
bytedcli slardar web flex config get --bid <bid> --env <env> --id <analyze-id>
bytedcli slardar web flex config save --bid <bid> --env <env> --query-config-file ./sample-query-config.json
bytedcli slardar web flex query series --bid <bid> --env <env> --request-file ./sample-request.json --group-by-list-json '[{"group_by_name":"sample.dimension"}]'
bytedcli slardar web flex query histogram --bid <bid> --env <env> --request-file ./sample-request.json --histogram-config-list-file ./sample-histogram-config.json
bytedcli slardar web js-error-list --bid <bid> --env <env> --start-time <start-time> --end-time <end-time> --origin <slardar-origin>
bytedcli slardar web js-error-issue-detail --bid <bid> --env <env> --issue-id <issue-id> --start-time <start-time> --end-time <end-time> --origin <slardar-origin>
bytedcli slardar web js-error-issue-stack --bid <bid> --env <env> --issue-id <issue-id> --release <release> --start-time <start-time> --end-time <end-time> --origin <slardar-origin>

# App
bytedcli --json slardar app issue log --url "https://slardar.example/node/app_detail/?region=cn&aid=123&os=Android&type=app&lang=zh#/abnormal/detail/crash/demo_issue?params=%7B%22start_time%22%3A1773410940%2C%22end_time%22%3A1776089340%2C%22event_index%22%3A1%7D"
bytedcli --json slardar app issue log --symbolicate --url "https://slardar.example/node/app_detail/?region=cn&aid=123&os=Android&type=app&lang=zh#/abnormal/detail/crash/demo_issue?params=%7B%22start_time%22%3A1773410940%2C%22end_time%22%3A1776089340%2C%22event_index%22%3A1%7D"
bytedcli slardar app symbol url --build-id 00112233445566778899aabbccddeeff00112233
bytedcli slardar app symbol url --uuid 33221100554477660
bytedcli --json slardar app file list --aid 123 --os Android --region cn --device-id demo_device --start-time 1776092520 --end-time 1776351720
bytedcli --json slardar app file range --aid 123 --os Android --region cn --device-id demo_device --start-time 1776092520 --end-time 1776351720 --dimension scene
bytedcli slardar app file download --all --aid 123 --os Android --region cn --device-id demo_device --start-time 1776092520 --end-time 1776351720 --output ./logs

# OS
bytedcli --json slardar os issue log --url "https://slardar.example/node/os_detail/issue/overview/system/detail?app_id=123&start_time=1775491200&end_time=1776133985&region=cn&category=3&time_type=client_time&filter_conditions=%257B%2522type%2522%253A%2522and%2522%252C%2522sub_conditions%2522%253A%255B%255D%257D&issue_id=demo_issue&pgno=1"
bytedcli --json slardar os issue log --symbolicate --url "https://slardar.example/node/os_detail/issue/overview/system/detail?app_id=123&start_time=1775491200&end_time=1776133985&region=cn&category=3&time_type=client_time&filter_conditions=%257B%2522type%2522%253A%2522and%2522%252C%2522sub_conditions%2522%253A%255B%255D%257D&issue_id=demo_issue&pgno=1" --max-frames 20
```

## Behavior notes

- `slardar web dashboard get --with-raw` is the easiest way to capture the current dashboard payload before editing. Reuse the returned `items` and `extra` with `dashboard update --items-file ... --extra-file ...` when you need a full dashboard rewrite.
- `slardar web dashboard item add` accepts a single dashboard item JSON object; `slardar web dashboard update` accepts the full dashboard `items` array plus optional `extra`.
- `slardar app issue log --symbolicate` calls Slardar App retrace first, then falls back to local `.zst` native symbol download/decompression and `llvm-addr2line`.
- `slardar os issue log --symbolicate` extracts native frames from the OS event main thread stack, groups APK embedded frames by `BuildId + APK offset`, then reuses Slardar App native symbol helpers.
- If one native symbol group fails to download or symbolize, the result keeps unresolved frames for that group and continues with the remaining groups.

## References

- `references/slardar.md`
