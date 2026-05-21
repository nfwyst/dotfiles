---
name: bytedance-safe-hawkpro
description: Hawkpro trace and error-reason query operations via bytedcli safe domain. Use when the user asks for an objectID's machine-review error reason or Hawkpro error reason; also use when tracing moderation decisions by user/room/time/hit-type and viewing decision graph or rule-hit details.
---

# Safe Hawkpro — Trace Query

Query hawkpro moderation traces and HawkOps error reasons: list traces by user ID, room ID, time range, or hit type; get trace detail with execution graph, rule hit information, and disposition action analysis; use `trace doctor` when investigating objectID machine-review failures or Hawkpro error causes.

## Authentication

Requires Safe authentication. A single `safe login` covers `safe.bytedance.net`, `hawk.bytedance.net`, and `tcs.bytedance.net` via shared MPSSO cookies — no separate hawk login is needed.

```bash
bytedcli auth login --session
bytedcli safe login
```

If the hawk query reports missing permission, open the Hawk strategy tracing page below in a browser, apply for Hawk access, then retry:

```text
https://hawk.bytedance.net/v2/strategy_tracing?businessId=125&scene=community_audit_safe&start_time=1778223340945&end_time=1778309740945
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
bytedcli safe hawkpro trace get --id <trace-id>

# View 2: Find rules by risk label name
bytedcli safe hawkpro trace get --id <trace-id> --risk-label demo-label

# Show upstream chain with all conditions (works with both views)
bytedcli safe hawkpro trace get --id <trace-id> --upstream

# Combine risk-label and upstream
bytedcli safe hawkpro trace get --id <trace-id> --risk-label demo-label --upstream

# JSON output
bytedcli --json safe hawkpro trace get --id <trace-id>
```

### trace doctor

Diagnose the latest failed execution error reason for object_id(s).

```bash
bytedcli safe hawkpro trace doctor --scene demo-scene --object-id demo-object-id-1
bytedcli safe hawkpro trace doctor --scene demo-scene --object-id demo-object-id-1 --object-id demo-object-id-2 --hours 48
bytedcli --json safe hawkpro trace doctor --scene demo-scene --object-id demo-object-id-1
```

### scene list

List hawkpro scenes.

```bash
bytedcli safe hawkpro scene list
```

### scene update-runtime-conf

Update a scene's runtime configuration.

```bash
bytedcli safe hawkpro scene update-runtime-conf --id 6748 --action-conf '{"key": "value"}'
bytedcli safe hawkpro scene update-runtime-conf --key demo-key --action-conf ./path/to/conf.json
```

### rule list

List rules in a hawkpro scene.

```bash
bytedcli safe hawkpro rule list --scene-id 6748
bytedcli safe hawkpro rule list --scene-id 6748 --group-keyword demo
bytedcli safe hawkpro rule list --scene-id 6748 --rule-keyword spam
bytedcli --json safe hawkpro rule list --scene-id 6748
```

### action list

List actions in a hawkpro scene.

```bash
bytedcli safe hawkpro action list --scene-id 6748
bytedcli safe hawkpro action list --scene-id 6748 --keyword test
bytedcli --json safe hawkpro action list --scene-id 6748
```

### action copy

Copy actions to a target scene.

```bash
bytedcli safe hawkpro action copy --to-scene-id 6749 --action-ids 100 101
bytedcli --json safe hawkpro action copy --to-scene-id 6749 --action-ids 100
```

### scene add-param

Add a new parameter to a hawkpro scene.

```bash
bytedcli safe hawkpro scene add-param --id 6748 --param-key my_param --param-name "My Param" --param-value-type string
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

### scene list

| Option | Default | Description |
|--------|---------|-------------|
| `--keyword <name>` | — | Scene keyword |
| `--page <n>` | `1` | Page number |
| `--page-size <n>` | `10` | Page size |

### scene update-runtime-conf

| Option | Default | Description |
|--------|---------|-------------|
| `--id <id>` | — | Scene ID (at least one of --id or --key is required) |
| `--key <key>` | — | Scene Key |
| `--action-conf <conf>` | (required) | JSON string or path to JSON file |

### scene add-param

| Option | Default | Description |
|--------|---------|-------------|
| `--id <id>` | — | Scene ID (at least one of --id or --key is required) |
| `--key <key>` | — | Scene Key |
| `--param-key <key>` | (required) | Parameter key |
| `--param-name <name>` | (required) | Parameter name |
| `--param-value-type <type>`| (required) | Parameter value type (string/bool/int/float/[]string/[]int/[]float/map) |
| `--param-is-encrypt` | `false` | Whether the parameter is encrypted |
| `--param-material-type <type>`| — | Material type |
| `--param-desc <desc>` | — | Parameter description |

### rule list

| Option | Default | Description |
|--------|---------|-------------|
| `--scene-id <id>` | (required) | Scene ID |
| `--group-keyword <name>` | — | Group keyword |
| `--rule-keyword <name>` | — | Rule keyword |
| `--page <n>` | `1` | Page number |
| `--page-size <n>` | `10` | Page size |

### action list

| Option | Default | Description |
|--------|---------|-------------|
| `--scene-id <id>` | — | Scene ID (required if --scene-key is absent) |
| `--scene-key <key>` | — | Scene Key (required if --scene-id is absent) |
| `--keyword <name>` | — | Action keyword |
| `--page <n>` | `1` | Page number |
| `--page-size <n>` | `10` | Page size |

### action copy

| Option | Default | Description |
|--------|---------|-------------|
| `--to-scene-id <id>` | (required) | Target scene ID |
| `--action-ids <ids...>` | (required) | Action IDs to copy |

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
