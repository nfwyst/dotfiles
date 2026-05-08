---
name: bytedance-safe-sample
description: Safe sample library query operations via bytedcli safe domain. Use this whenever the user wants to query Safe sample data, mentions safe sample, sample list, 样本库, 查样本, 风险标签样本, annotation task or dataset sample queries, or needs help turning a sample-query intent into condition JSON/file plus tenant, business-id, and business-key.
---

# Safe Sample — Sample Library

Query sample library records on the Safe sample platform.

## Command

```bash
bytedcli safe sample list (--condition-json <json> | --condition-file <path>) [--need-feature <key> ...] [--page <page>] [--page-size <size>] [--tenant <tenant>] [--business-id <id>] [--business-key <key>]
```

## Recommended workflow

1. Prepare sample authentication: `bytedcli auth login --session`, then `bytedcli safe login`
2. Translate natural language into four parts before executing: `tenant`, `category_id`, label filter, and time range
3. Prefer `--condition-file` over long inline `--condition-json`
4. Provide `--tenant`, `--business-id`, and `--business-key`
5. Add repeatable `--need-feature` keys for fields you want extracted into `samples[*].features`
6. Use `--json` when another tool, agent, or script will consume the result

## Authentication for sample queries

Safe sample queries use the Safe cookie stored by `bytedcli safe login`. On a fresh machine, run the SSO browser-session step first:

```bash
bytedcli auth login --session
bytedcli safe login
```

For agent or JSON-driven login orchestration, start the SSO browser-session flow with `bytedcli --json auth login --begin --session`, complete it with `bytedcli --json auth login --complete <token>`, then run `bytedcli safe login`.

If a user already provides a Safe cookie, `bytedcli safe login --cookie "session=xxx"` is also valid. Do not ask for manual cookies before trying the SSO-session path.

## Natural-language execution contract

This skill is expected to turn a user request such as:

- “查 webcast 近 7 天图音综合流、指定 label id 的样本”
- “查询智能标注近 7 天的直播图音综合流封建迷信数据”

into a runnable `bytedcli safe sample list` command.

When assembling from natural language, use this order:

1. Resolve tenant
   - “直播” / “webcast” -> `--tenant webcast`
2. Resolve category candidate
   - “图音综合流” should be normalized to the webcast intelligent-annotation integrated stream candidate documented in `sample-guide.md`
3. Resolve risk label filter
   - If the user gives a concrete `label id`, prefer it directly over fuzzy label-name guessing
4. Resolve time range
   - “近7天” -> `biz_time_range` covering `[now-7d, now]`
5. Build condition JSON and execute `bytedcli --json safe sample list`

If the request already includes tenant/category/label/time-range with enough precision, do not stop at advice. Assemble the command and run it.

If business headers are missing, ask only for the minimum missing execution inputs:

- `business-id`
- `business-key`
- `biz-scene-id` when required by `risk_label_ids`

Do not ask again for tenant/category/time range when those are already inferable from the natural-language request and the mapping guide.

## Examples

```bash
bytedcli safe sample list \
  --condition-file ./sample-condition.json \
  --tenant <tenant> \
  --business-id <business-id> \
  --business-key <business-key>

bytedcli --json safe sample list \
  --condition-file ./sample-condition.json \
  --need-feature dataset_id \
  --need-feature annotation_task_id \
  --need-feature room.room_id \
  --page 1 \
  --page-size 20 \
  --tenant <tenant> \
  --business-id <business-id> \
  --business-key <business-key>

bytedcli safe sample list \
  --condition-json '{"category_id":"<category-id>"}' \
  --tenant <tenant> \
  --business-id <business-id> \
  --business-key <business-key>

bytedcli --json safe sample list \
  --condition-file ./sample-condition.json \
  --tenant webcast \
  --business-id <business-id> \
  --business-key <business-key>
```

### Natural-language assembly example

User intent:

> 查询智能标注近7天的直播的图音综合流的封建迷信的数据

Expected assembly pattern:

- tenant -> `webcast`
- category -> use the webcast intelligent-annotation integrated-stream category candidate from `sample-guide.md`
- time range -> `biz_time_range`
- label filter -> prefer concrete `label id`; if the user only gives a label name such as “封建迷信”, first resolve or request the exact `label id`

Example condition file:

```json
{
  "category_id": "46180000002",
  "risk_label_ids": {
    "<biz-scene-id>": ["<label-id>"]
  },
  "biz_time_range": {
    "from_time": 1700000000,
    "to_time": 1700604800
  }
}
```

Example execution:

```bash
bytedcli --json safe sample list \
  --condition-file ./sample-condition.json \
  --need-feature dataset_id \
  --need-feature annotation_task_id \
  --need-feature room.room_id \
  --tenant webcast \
  --business-id <business-id> \
  --business-key <business-key>
```

## Common Options

- `--tenant <tenant>` — Tenant for API requests. Priority: CLI > env (`SAFE_TENANT`) > config > default.
- `--business-id <id>` / `--business-key <key>` — Sample business headers. Priority: CLI > env (`SAFE_BUSINESS_ID`, `SAFE_BUSINESS_KEY`) > safe config (`business_id`, `business_key`).
- `--need-feature <key>` — Request and extract additional fields into `samples[*].features`.
- `--page` / `--page-size` — Pagination controls.

## References

- [sample-api.md](references/sample-api.md) — API and payload shape
- [sample-guide.md](references/sample-guide.md) — Usage patterns and troubleshooting
