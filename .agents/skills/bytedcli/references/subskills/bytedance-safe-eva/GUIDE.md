---
name: bytedance-safe-eva
description: EVA platform model and evaluation management via bytedcli. Sub-skill of bytedance-safe for querying models, features, prompts, evaluations, and time ranges.
---

# Safe EVA

EVA (Evaluation) platform commands for model management, feature queries, prompt queries, evaluation list, and time range queries.

## Prerequisites

Requires Safe authentication. If not already logged in:

```bash
bytedcli safe login
```

## Commands

### Model Management

```bash
# Create a new EVA model (time range is auto-fetched from server)
bytedcli safe eva model create --name <name> [--config-key <key>] [--prompt-type <n>] [--model-type <n>] [--admin-list <users...>]

# List EVA models (use --ids for permission details)
bytedcli safe eva model list [--ids <ids...>] [--config-key <key>] [--page <n>] [--page-size <n>]
```

### Feature & Prompt Queries

```bash
# List features for a model
bytedcli safe eva feature list --model-id <id> [--config-key <key>] [--status <status...>] [--page <n>] [--page-size <n>]

# List prompts for a model (default page_size: 10000)
bytedcli safe eva prompt list --model-id <id> [--config-key <key>] [--prompt-type <n>] [--page <n>] [--page-size <n>] [--cursor <n>]
```

### Evaluations

```bash
# Search evaluations by prompt
bytedcli safe eva evaluation list --prompt-id <id> [--config-key <key>] [--prompt-type <n>]

# Query evaluation details
bytedcli safe eva evaluation get --evaluation-ids <ids...> [--config-key <key>] [--prompt-type <n>]
```

### Time Range

```bash
# Query evaluation time ranges
bytedcli safe eva evaluation time-range [--config-key <key>] [--prompt-type <n>] [--model-type <n>]
```

## Options

- `--config-key <key>` — Config key (default: `live_review_general`). Supported on all subcommands.
- `--prompt-type <n>` — Prompt type (default: 1)
- `--model-type <n>` — Model type (default: 68)
- `--page <n>` / `--page-size <n>` — Pagination parameters
- `--cursor <n>` — Pagination cursor (prompt list only)
- `-j` / `--json` — JSON output mode

## Notes

- All commands support JSON output mode with `--json`
- Authentication uses the same cookie/session as other safe commands
- `--model-type` defaults to 68 (multimodal model), `--prompt-type` defaults to 1
- `--config-key` defaults to `live_review_general` on all commands
- `prompt list` uses a default `--page-size` of 10000 (vs. the standard 20) to return all prompts by default
- `model create` automatically fetches the evaluation time range from the server before creating the model; the time range is determined by `--config-key`, `--prompt-type`, and `--model-type`
