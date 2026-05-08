# Sample API Reference

## Base URL

`https://safe.bytedance.net/`

## Authentication

- Sample queries reuse the Safe cookie stored by `bytedcli safe login`
- On a fresh machine, first run `bytedcli auth login --session`, then run `bytedcli safe login` to exchange the local SSO browser session for the Safe cookie
- If a Safe cookie is already available, `bytedcli safe login --cookie "session=xxx"` can seed it directly
- There is no separate sample-only login flow
- Sample queries also require request context from `tenant`, `business-id`, and `business-key`
- When `--business-id` / `--business-key` are supplied, bytedcli sends the sample business headers required by the API

## Endpoint

| Method | HTTP | Path |
|--------|------|------|
| QuerySamples | POST | /api/sample/v1/samples |

## CLI-to-request mapping

| CLI input | Upstream request |
|-----------|------------------|
| `--condition-json` / `--condition-file` | `condition` |
| `--need-feature <key>` | `need_features[]` |
| `--page <n>` | `page` |
| `--page-size <n>` | `page_size` |
| `--tenant`, `--business-id`, `--business-key` | headers / request context |

## Request format

```json
{
  "condition": {
    "category_id": "<category-id>"
  },
  "need_features": ["dataset_id", "annotation_task_id"],
  "page": 1,
  "page_size": 20
}
```

## Response format

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "samples": [
      {
        "id": "<sample-id>",
        "extra_data": "{...}",
        "origin_data": "{...}"
      }
    ],
    "total": 123
  }
}
```

## Notes

- Provide exactly one of `--condition-json` or `--condition-file`
- Prefer `--condition-file` for realistic payloads and complex filters
- `expression_group` queries should include `category_id`
- `need_features` can include dotted keys such as `room.room_id` and `user.base_nickname`
- bytedcli parses `extra_data` / `origin_data` defensively and exposes requested values in `samples[*].features`
