# Hire CLI Reference

## hire evaluation list

List resume evaluations assigned to the current Hire user.

```bash
bytedcli hire evaluation list
bytedcli hire evaluation list --status done --page 2 --page-size 20
bytedcli --json hire evaluation list --status pending
```

| Option | Description | Default |
|---|---|---|
| `--status <status>` | Activity status: `all`(全部), `pending`(待评估), `done`(已评估), `skipped`(无需评估). | `pending` |
| `--keyword <text>` | Keyword forwarded to the Hire search box. | `""` |
| `--page <n>` | 1-based page number. | `1` |
| `--page-size <n>` | Page size. | `20` |

Text output shows: evaluation ID, application, job, talent, stage, conclusion, evaluator, creator, created time, and modified time. After the table, CLI prints a `People URLs:` block with one `<candidate name> (<talent id>): <url>` line per row. When `list_v2` includes nested `talent` / `job` / `application` / `stage` objects, CLI prefers readable names and talent profile snippets (for example candidate name, school, preferred cities) over raw IDs.

JSON output returns `evaluations`, `page_count` (current page row count), `page`, `page_size`, `offset`, `has_more`, `status`, `activity_status`, `keyword`. Each evaluation row also includes a derived `people_url`.

### Limitations

- Nested objects may vary by backend response. If readable fields are missing, CLI falls back to IDs from the same row.
- The backend does not return a server-side total. JSON output therefore exposes `page_count` for the current page and `has_more` for pagination.

## hire interview list

List interviews assigned to the current Hire user.

```bash
bytedcli hire interview list
bytedcli hire interview list --status all --page 2 --page-size 20
bytedcli --json hire interview list --status pending
```

| Option | Description | Default |
|---|---|---|
| `--status <status>` | Activity status: `all`(全部), `upcoming`(未开始), `pending`(未评价), `done`(已评价). | `all` |
| `--keyword <text>` | Keyword forwarded to the Hire search box. | `""` |
| `--page <n>` | 1-based page number. | `1` |
| `--page-size <n>` | Page size. | `20` |

Text output shows: interview ID, begin time, end time, round, job, talent, stage, interviewer, created time, and modified time. After the table, CLI prints a `People URLs:` block with one `<candidate name> (<talent id>): <url>` line per row. When `list_v2` includes nested `talent` / `job` / `application` / `stage` objects, CLI prefers readable names and talent profile snippets over raw IDs.

JSON output returns `interviews`, `page_count` (current page row count), `page`, `page_size`, `offset`, `has_more`, `status`, `activity_status`, `keyword`. Each interview row also includes a derived `people_url`.

## hire resume get

Get the default resume bound to a Hire application.

```bash
bytedcli hire resume get --talent-id demo-talent-id --application-id demo-application-id
bytedcli --json hire resume get --talent-id demo-talent-id --application-id demo-application-id
```

| Option | Description | Default |
|---|---|---|
| `--talent-id <id>` | Talent ID used by the Hire application record. | required |
| `--application-id <id>` | Application ID used by the Hire application record. | required |

Text output shows: talent ID, application ID, a `People Link` back to Hire talent detail, resume ID, resume name, resume source, resume type, attachment name, file size, candidate name, mobile, email, education summary, preview URL, download URL, updated time when present, and a grouped readable `Parsed Content` view when the backend includes `default_attachment.parsed_content`.

JSON output returns `resume`, preserving the parsed fields plus a derived `people_url` and the backend `raw` payload.

### Limitations

- This command currently calls `https://people-cn.bytedance.com/atsx/api/application/get_default_resume/`, while `hire evaluation list` and `hire interview list` still call `https://people.bytedance.net/atsx/api/...`.
- Resume payload fields may vary across scenarios; text mode prints a best-effort grouped `Parsed Content` view and a stable Hire talent detail link, while JSON mode always preserves the raw payload.
