---
name: bytedance-safe-hawkpro
description: Hawkpro trace query operations via bytedcli safe domain. Use when tracing moderation decisions — list traces by user/room/time/hit-type, get trace detail with decision graph and rule hit information.
---

# Safe Hawkpro — Trace Query

Query hawkpro moderation trace entries: list traces by user ID, room ID, time range, or hit type; get trace detail with execution graph, rule hit information, and disposition action analysis.

## Authentication

Requires Safe authentication. See the parent skill `bytedance-safe` for login instructions:

```bash
bytedcli auth login --session
bytedcli safe login
```

## Commands

### trace list

List trace entries for a user or live room.

```bash
# By user ID (default: last 7 days, hit only)
bytedcli safe hawkpro trace list --uid 3722318767734586

# By user ID with day range
bytedcli safe hawkpro trace list --uid 3722318767734586 --days 3

# Multiple users
bytedcli safe hawkpro trace list --uid 3722318767734586 --uid 8765432109876543

# By room ID
bytedcli safe hawkpro trace list --room-id 7631824140719737626

# With time range (relative)
bytedcli safe hawkpro trace list --uid 3722318767734586 --start "2h ago"

# With time range (absolute)
bytedcli safe hawkpro trace list --uid 3722318767734586 --start "2026-04-01" --end "2026-04-27"

# Filter by hit type
bytedcli safe hawkpro trace list --uid 3722318767734586 --hit-type all
bytedcli safe hawkpro trace list --uid 3722318767734586 --hit-type not_hit

# Filter by action type
bytedcli safe hawkpro trace list --uid 3722318767734586 --action-type 送处置

# Pagination
bytedcli safe hawkpro trace list --uid 3722318767734586 --page-size 50
bytedcli safe hawkpro trace list --uid 3722318767734586 --cursor <next-cursor>

# JSON output
bytedcli --json safe hawkpro trace list --uid 3722318767734586
```

### trace get

Get trace detail by trace ID. Shows execution graph, rule hit results, and disposition action analysis.

```bash
# Basic detail (auto-detects disposition rules, shows View 1)
bytedcli safe hawkpro trace get --id 1776927119952144745

# View 2: Find rules by risk label name
bytedcli safe hawkpro trace get --id 1776927119952144745 --risk-label demo-label

# Show upstream chain with all conditions (works with both views)
bytedcli safe hawkpro trace get --id 1776927119952144745 --upstream

# Combine risk-label and upstream
bytedcli safe hawkpro trace get --id 1776927119952144745 --risk-label demo-label --upstream

# JSON output
bytedcli --json safe hawkpro trace get --id 1776927119952144745
```

## Options

### trace list

| Option | Default | Description |
|--------|---------|-------------|
| `--uid <uid...>` | — | User ID filter (repeatable) |
| `--room-id <roomId...>` | — | Live room ID filter (repeatable) |
| `--scene-id <sceneId>` | `6748` | Scene ID |
| `--start <time>` | — | Start time: Unix seconds, date string, or relative (`"2h ago"`, `"1 day ago"`) |
| `--end <time>` | — | End time (same format as `--start`) |
| `--days <days>` | `7` | Day range when `--start`/`--end` are omitted (max: 7) |
| `--hit-type <type>` | `hit` | `hit`, `not_hit`, or `all` |
| `--action-type <type>` | — | Effect action type filter (e.g. `送处置`) |
| `--page-size <n>` | `20` | Page size (max: 100) |
| `--cursor <cursor>` | — | Pagination cursor from previous response |

### trace get

| Option | Default | Description |
|--------|---------|-------------|
| `--id <id>` | (required) | Trace ID |
| `--risk-label <name>` | — | Find rules by risk label name (View 2) |
| `--upstream` | `false` | Show upstream chain with all conditions |

## Output Modes

### trace get views

- **View 1 (default)**: When the trace has disposition actions, displays only the rules that affected the disposition, with their hit conditions and upstream dependencies.
- **View 2 (`--risk-label`)**: Searches graph nodes for the specified risk label, displays all matching rules with full condition details.

The `--upstream` flag adds upstream chain information to either view, showing parent node conditions.

### JSON mode

Use `--json` for machine-readable output. The JSON response matches the raw API response structure and includes full trace detail with graph nodes, action lists, and rule information.

## Common Patterns

**Investigating a user's recent hits:**
```bash
bytedcli safe hawkpro trace list --uid <uid> --hit-type hit --days 3
```

**Finding traces that triggered disposition:**
```bash
bytedcli safe hawkpro trace list --uid <uid> --action-type 送处置 --days 7
```

**Understanding why a trace was disposed:**
```bash
# Step 1: List to find the trace
bytedcli safe hawkpro trace list --uid <uid> --start "2h ago"
# Step 2: Get detail to see disposition rules
bytedcli safe hawkpro trace get --id <trace-id>
```

**Tracing upstream rule conditions:**
```bash
bytedcli safe hawkpro trace get --id <trace-id> --upstream
```
