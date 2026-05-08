# NexDE CLI Reference

## nexde project list

List the current user's NexDE projects.

```bash
bytedcli nexde project list --region sg
bytedcli --json nexde project list --region sg
```

| Option | Description | Default |
|---|---|---|
| `--region <region>` | NexDE region. Currently only `sg` is supported. | `sg` |

Text output shows project ID, name, owner, and description when present. JSON output returns `projects`, `total`, and `region`.
