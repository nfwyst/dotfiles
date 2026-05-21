---
name: bytedance-hire
description: "Operate ByteDance Hire (people.bytedance.net / people-cn.bytedance.com) evaluation, interview, and resume workflows via bytedcli. Use when tasks mention 简历评估, 面试列表, 获取简历, hire evaluation, hire interview, hire resume, people.bytedance.net, people-cn.bytedance.com, 面试官待评估简历, resume evaluation list, interview list assigned to the user, or default resume retrieval."
---

# bytedcli Hire

Hire CLI wraps `people.bytedance.net/atsx/api` and reuses Titan Passport authentication via `bytedcli auth login`.

## When to use

- List resume evaluations assigned to the current user (pending / done / all / skipped).
- List interviews assigned to the current user (all / upcoming / pending / done).
- Get the default resume bound to a talent application.
- Check evaluation status for a candidate application before opening the web console.

## Commands

```bash
# Default: pending evaluations for the current user
bytedcli hire evaluation list

# Filter by status (all | pending | done | skipped)
bytedcli hire evaluation list --status pending
bytedcli hire evaluation list --status done

# Pagination (page is 1-based)
bytedcli hire evaluation list --page 2 --page-size 20

# Keyword filter (matches the same search box as the web console)
bytedcli hire evaluation list --keyword "Frontend"

# JSON output for agents
bytedcli --json hire evaluation list --status pending

# Interview list for the current user
bytedcli hire interview list
bytedcli hire interview list --status all
bytedcli hire interview list --status upcoming
bytedcli --json hire interview list --status pending

# Get the default resume for a talent application
bytedcli hire resume get --talent-id demo-talent-id --application-id demo-application-id
bytedcli --json hire resume get --talent-id demo-talent-id --application-id demo-application-id
```

## Notes

- `--status` default is `pending`; values map to `activity_status` codes `all(全部)=0`, `pending(待评估)=1`, `done(已评估)=2`, `skipped(无需评估)=3`.
- `hire interview list` uses a different status mapping: `all(全部)=0`, `upcoming(未开始)=1`, `pending(未评价)=2`, `done(已评价)=3`.
- `hire interview list` sends `from_my_task_list=true` and `time_zone=Asia/Shanghai`, matching the current web request shape.
- `hire resume get` currently calls `https://people-cn.bytedance.com/atsx/api/application/get_default_resume/`, while the list APIs still use `https://people.bytedance.net/atsx/api/...`; both paths are under the same Hire/ATSX domain family but should be treated as different hosts in client and test coverage.
- `hire resume get` text mode shows attachment metadata, a stable `People Link`, parsed resume profile fields such as candidate name, mobile, email, and the first education summary, and appends a grouped readable `Parsed Content` view when `default_attachment.parsed_content` is available; JSON mode also returns `people_url` and still preserves the backend `raw` payload.
- The list endpoint always returns IDs and may also return nested objects such as `talent`, `job`, `application`, or `stage`. CLI text output prefers readable fields like candidate name, school, preferred cities, job name, and stage name when the backend includes them; `hire evaluation list` and `hire interview list` print `People URLs` in a separate per-row block after the table for direct talent detail navigation. JSON output for both list commands appends a derived `people_url` per row.
- Pagination has no `total` field from the server. JSON output therefore exposes `page_count` for the current page size instead of a fake total; `has_more` is `true` when the current page is full.
- Authentication requires `bytedcli auth login` on the `cn` site; this uses Titan Passport against `https://do.bytedance.net/titan/passport/id`.
