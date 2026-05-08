# Sample Query Usage Guide

## Quick Start

1. Prepare sample authentication:
   ```bash
   bytedcli auth login --session
   bytedcli safe login
   ```
2. Set defaults if needed:
   ```bash
   bytedcli safe config set --key tenant --value <tenant>
   bytedcli safe config set --key business_id --value <business-id>
   bytedcli safe config set --key business_key --value <business-key>
   ```
3. Save a condition JSON object to a file such as `sample-condition.json`
4. Run the query in JSON mode:
   ```bash
   bytedcli --json safe sample query_samples \
     --condition-file ./sample-condition.json \
     --tenant <tenant> \
     --business-id <business-id> \
     --business-key <business-key>
   ```

## Condition Patterns

### Filter by category

```json
{
  "category_id": "<category-id>"
}
```

### Filter by category and risk label

```json
{
  "category_id": "<category-id>",
  "risk_label_ids": {
    "<biz-scene-id>": ["<risk-label-id>"]
  }
}
```

### Filter by annotation task

```json
{
  "category_id": "<category-id>",
  "expression_group": {
    "logic": "and",
    "expressions": [
      {
        "operator": "eq",
        "left": "annotation_task_id",
        "right": "<annotation-task-id>"
      }
    ]
  }
}
```

### Filter by business time and case type

```json
{
  "category_id": "<category-id>",
  "case_type": 11,
  "biz_time_range": {
    "from_time": 1700000000,
    "to_time": 1700086400
  }
}
```

### Filter by category, risk label, and recent 7-day time range

```json
{
  "category_id": "<category-id>",
  "risk_label_ids": {
    "<biz-scene-id>": ["<risk-label-id>"]
  },
  "biz_time_range": {
    "from_time": 1700000000,
    "to_time": 1700604800
  }
}
```

## Common `case_type` hints

| Value | Meaning |
|-------|---------|
| `0` | Undetermined |
| `11` | Positive sample |
| `12` | Strong positive sample |
| `21` | Negative sample |
| `22` | Hard negative sample |

## Tenant mapping hints

The following tenant mappings come from the user-provided CSV in `.chat` and can be used to turn natural-language business context into `--tenant` values.

| Tenant code | 中文含义 |
|-------------|----------|
| `webcast` | 直播 |
| `community` | 视频 |
| `playlet` | 短剧 |
| `ecology` | 视频生态 |
| `open` | 小程序 |
| `entertainment` | 泛娱乐 |
| `account` | 账号 |
| `im` | im |
| `perfesional` | perfesional |
| `common` | common |

Use this mapping when the user says things like:

- “直播样本” -> `--tenant webcast`
- “视频样本” -> `--tenant community`
- “短剧样本” -> `--tenant playlet`

## Category mapping hints

The following category mappings also come from the user-provided CSV in `.chat`. Treat them as lookup candidates, not guaranteed one-to-one rules. In particular, do not assume a single `category_id` from `tenant` alone.

| Category ID | Tenant | Material type | Source |
|-------------|--------|---------------|--------|
| `322352800002` | `webcast` | 图片流 | 智能标注 |
| `131735200002` | `webcast` | 泛娱乐 | 智能标注 |
| `225892000002` | `webcast` | 直播_通用 | 智能标注 |
| `589770609154` | `webcast` | 直播切片 | 智能标注 |
| `72752800002` | `webcast` | 直播测试题材 | 智能标注 |
| `46180000002` | `webcast` | 综合事件流 | 智能标注 |
| `802813821698` | `webcast` | 综合事件流 | 直播生态智能标注 |
| `386096800002` | `webcast` | 音频流 | 智能标注 |
| `281956000514` | `community` | 视频 | 智能标注 |
| `209764483586` | `ecology` | 视频 | 智能标注 |
| `400996000002` | `playlet` | 短剧 | 智能标注 |
| `184573652738` | `open` | 小程序 | 智能标注 |

### Additional category examples

| Category ID | Tenant | Material type | Source |
|-------------|--------|---------------|--------|
| `209764000002` | `webcast` | 图片流 | 优质样本基建 |
| `400996000514` | `webcast` | 直播_通用 | 优质样本基建 |
| `209764000514` | `webcast` | 综合事件流 | 优质样本基建 |
| `191485831170` | `community` | 视频 | 优质样本基建 |
| `260912817666` | `playlet` | 短剧 | 高质量样本 |
| `271664985346` | `entertainment` | 泛娱乐 | 高质量样本 |
| `1512752800002` | `community` | 视频 | cot机标回流表 |
| `796823200258` | `webcast` | 直播测试题材 | 样本挖掘 |

## Natural-language assembly guidance

### Rule 1: map business language to tenant first

- “直播” -> `--tenant webcast`
- “视频” -> `--tenant community`
- “短剧” -> `--tenant playlet`

This step is usually stable.

### Rule 1.5: resolve explicit execution slots from natural language

For complex sample queries, normalize the request into these execution slots:

- `tenant`
- `category_id`
- `risk_label_ids`
- `biz_time_range`

Example:

- “webcast / 直播” -> `--tenant webcast`
- “指定 label id=12345” -> `risk_label_ids`
- “近7天” -> `biz_time_range`
- “图音综合流” -> category candidate under webcast intelligent annotation mapping

### Rule 2: never choose `category_id` from tenant alone

For sample queries, `category_id` should be narrowed by at least:

- `tenant`
- `material_type`
- `source`

If the user only says “直播样本” or “直播智能标注样本”, that is not enough to determine a unique `category_id`.

### Rule 3: if multiple rows match, return candidates instead of guessing

For example, under `webcast` with intelligent annotation related rows, the CSV contains multiple categories such as:

| Category ID | Material type | Source |
|-------------|---------------|--------|
| `322352800002` | 图片流 | 智能标注 |
| `131735200002` | 泛娱乐 | 智能标注 |
| `225892000002` | 直播_通用 | 智能标注 |
| `589770609154` | 直播切片 | 智能标注 |
| `72752800002` | 直播测试题材 | 智能标注 |
| `46180000002` | 综合事件流 | 智能标注 |
| `81815205634` | 综合事件流 | 智能标注 |
| `386096800002` | 音频流 | 智能标注 |
| `1351933603842` | 风险案例库 | 智能标注 |
| `1298941606146` | 风险案例库 | 智能标注 |

That means the skill should surface candidates like these and ask the caller to confirm the intended material type or source instead of silently picking one.

### Safer assembly examples

#### Example: 用户说“查直播综合事件流的智能标注样本”

This is narrower than just “直播智能标注”, but it is still not always unique. The CSV contains at least these candidates:

- `46180000002` -> `webcast / 综合事件流 / 智能标注`
- `81815205634` -> `webcast / 综合事件流 / 智能标注`

Safe behavior:

- set `--tenant webcast`
- present both candidate `category_id` values
- do not silently choose one unless there is additional confirmed business context

#### Example: 用户说“查 webcast 指定 label id、近7天、图音综合流的数据”

This is the target high-value execution pattern for this skill.

Expected assembly:

- `--tenant webcast`
- `category_id`: use the webcast intelligent-annotation integrated-stream mapping
- `risk_label_ids`: use the provided label id directly
- `biz_time_range`: set to the most recent 7-day window

Condition template:

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

Runnable command template:

```bash
bytedcli --json safe sample query_samples \
  --condition-file ./sample-condition.json \
  --tenant webcast \
  --business-id <business-id> \
  --business-key <business-key>
```

If the user says “封建迷信” but does not provide the concrete label id, the skill should first resolve or request the exact label id instead of guessing from the label name.

#### Example: 用户说“查询智能标注近7天的直播的图音综合流的封建迷信的数据”

Recommended behavior:

- map “直播” -> `webcast`
- map “近7天” -> `biz_time_range`
- map “图音综合流” to the integrated-stream category candidate under webcast intelligent annotation
- treat “封建迷信” as a label intent; if there is already a known `label id`, use it directly, otherwise ask only for the exact label id or the upstream mapping source

If your environment standardizes “图音综合流” to the webcast intelligent-annotation integrated-stream category, prefer assembling and running the command rather than stopping at a generic explanation.

#### Example: 用户说“查直播通用的智能标注样本”

Candidate:

- `225892000002` -> `webcast / 直播_通用 / 智能标注`

This is a stronger candidate because the row is more specific, but it should still be described as a candidate derived from the CSV mapping rather than a guaranteed universal rule.

#### Example: 用户说“查视频智能标注样本”

Candidate:

- `281956000514` -> `community / 视频 / 智能标注`

This is a reasonable candidate from the CSV, but if the user actually means another video-related source table, list alternatives instead of forcing this value.

#### Example: 用户说“查短剧智能标注样本”

Candidate:

- `400996000002` -> `playlet / 短剧 / 智能标注`

This is a reasonable candidate from the CSV and is more specific than a tenant-only mapping.

## How to use the mapping safely

- First map the natural-language business domain to `tenant`
- Then narrow `category_id` by `material_type + source`
- If the user mentions “智能标注”, prefer rows whose `source` is `智能标注`
- If the user explicitly asks for webcast + label id + recent 7 days + 图音综合流, prefer producing a runnable `condition` object instead of only returning guidance
- If the user mentions “优质样本”, prefer rows whose `source` is `优质样本基建` or `高质量样本`
- If multiple rows still match, return candidate categories instead of guessing silently
- If the same `tenant + material_type + source` combination maps to multiple IDs, treat the mapping as ambiguous
- Treat the CSV as an assistant-side lookup aid, not as an authoritative guarantee that one phrase always maps to one category

## Tips

- Prefer `--condition-file` over long inline JSON
- Add `--json` for machine-readable output
- Repeat `--need-feature` to request multiple fields
- Dotted feature keys such as `room.room_id` and `user.base_nickname` are supported
- If you use `expression_group`, include `category_id` in the same condition

## Common Issues

- `SAFE_AUTH_REQUIRED` / `401 No login`
  - Run `bytedcli auth login --session`, then `bytedcli safe login`
  - If the error says `BDSSO cookie not found`, the missing step is `auth login --session`
- `Invalid JSON in --condition-json`
  - Move the payload into `--condition-file`
- Requested feature is missing from `samples[*].features`
  - Confirm the field exists in upstream `extra_data`
  - Confirm the `--need-feature` name matches the upstream key exactly
