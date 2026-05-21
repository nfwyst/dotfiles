---
name: bytedance-lark
description: "Operate Feishu/Lark via bytedcli lark (wrapped by bytedcli lark): docs, im, calendar, task, drive, sheets, base, wiki, mail, slides, minutes, okr, approval, attendance, vc, whiteboard, and event subscriptions. Use when the user wants to interact with Feishu/Lark platform features through the lark-cli-powered interface. Covers 17 domains with 200+ commands."
---

# bytedcli lark (powered by lark-cli)

`bytedcli lark` wraps the official [lark-cli](https://github.com/larksuite/cli) binary, providing access to all Feishu/Lark Open Platform capabilities.

## Quick Start

```bash
# First-time setup: configure app credentials
bytedcli lark config

# Authorize user
bytedcli lark login

# Start using
bytedcli lark calendar agenda
bytedcli lark im message send --chat-id oc_xxx --text "Hello"
bytedcli lark docs fetch --doc <url-or-token>
```

## Authentication

Authentication is managed by lark-cli:

1. `bytedcli lark config` — configure app_id/app_secret (interactive)
2. `bytedcli lark login` — authorize user via OAuth device flow
3. `bytedcli lark auth status` — check current auth state

## Domains

| Domain | Description | Skill Reference |
|--------|-------------|-----------------|
| docs | Document CRUD, search, media | [lark-doc](lark-doc/GUIDE.md) |
| contact | User search and lookup | [lark-contact](lark-contact/GUIDE.md) |
| wiki | Wiki spaces and nodes | [lark-wiki](lark-wiki/GUIDE.md) |
| calendar | Events, attendees, free/busy | [lark-calendar](lark-calendar/GUIDE.md) |
| task | Tasks, tasklists, subtasks | [lark-task](lark-task/GUIDE.md) |
| drive | Files, permissions, comments | [lark-drive](lark-drive/GUIDE.md) |
| sheets | Spreadsheet read/write | [lark-sheets](lark-sheets/GUIDE.md) |
| base | Bitable tables, records, fields | [lark-base](lark-base/GUIDE.md) |
| im | Messages, chats, media | [lark-im](lark-im/GUIDE.md) |
| mail | Email send, reply, drafts | [lark-mail](lark-mail/GUIDE.md) |
| slides | Presentations | [lark-slides](lark-slides/GUIDE.md) |
| minutes | Meeting minutes | [lark-minutes](lark-minutes/GUIDE.md) |
| okr | OKR management | [lark-okr](lark-okr/GUIDE.md) |
| approval | Approval workflows | [lark-approval](lark-approval/GUIDE.md) |
| vc | Video conferences | [lark-vc](lark-vc/GUIDE.md) |
| whiteboard | Whiteboards | [lark-whiteboard](lark-whiteboard/GUIDE.md) |
| attendance | Attendance records | [lark-attendance](lark-attendance/GUIDE.md) |
| event | Event subscriptions | [lark-event](lark-event/GUIDE.md) |

## Shared Rules

See [lark-shared](lark-shared/GUIDE.md) for authentication details, identity management (`--as user|bot`), permission handling, and security rules.

## Command Patterns

```bash
# Subcommand style
bytedcli lark <domain> <action> [flags]

# Examples
bytedcli lark docs fetch --doc <url>
bytedcli lark im message send --chat-id oc_xxx --text "hello"
bytedcli lark task create --summary "Demo task"
bytedcli lark sheets read --url <spreadsheet-url> --range "Sheet1!A1:D10"
bytedcli lark base record list --base-token <token> --table-id <id>

# Raw API passthrough (any Lark Open Platform endpoint)
bytedcli lark api GET /open-apis/calendar/v4/calendars
bytedcli lark api POST /open-apis/im/v1/messages --params '{"receive_id_type":"chat_id"}' --data '{"receive_id":"oc_xxx","msg_type":"text","content":"{\"text\":\"hello\"}"}'

# Schema introspection
bytedcli lark schema im.messages.create
```

## Output

- Default: human-readable pretty output
- With `-j` / `--json`: raw JSON from bytedcli lark (envelope: `{"ok": true, "data": {...}}`)
