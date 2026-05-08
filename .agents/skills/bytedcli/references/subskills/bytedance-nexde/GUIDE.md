---
name: bytedance-nexde
description: "Operate NexDE deployment platform via bytedcli. Use when tasks mention NexDE, NexDE projects, deployment YAML sync status, NexDE repository branches, NexDE deployments, or listing the user's NexDE projects. Prefer this skill whenever users need NexDE read/query commands instead of opening the web console."
---

# bytedcli NexDE

NexDE CLI uses Titan Passport authentication through `bytedcli auth login`.

## When to use

- List the current user's NexDE projects.
- Inspect NexDE read-only resources before deployment or sync operations.

## Commands

```bash
# List my NexDE projects
bytedcli nexde project list --region sg

# JSON output for agents
bytedcli --json nexde project list --region sg
```

## Notes

- `--region` currently supports `sg`.
- Use global `--json` before `nexde` for machine-readable output.
- Mutating NexDE operations such as sync or deployment creation are intentionally not documented here until native commands are added and guarded.
