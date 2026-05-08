---
name: bytedance-safe-tcs
description: TCS project and trace operations via bytedcli safe domain. Query TCS project detail and trace information, and update a project's ProductType by migrating it to a target project.
---

# Safe TCS — Project & Trace Operations

Query TCS project metadata and trace information, and perform limited write operations (such as ProductType migration) on the TCS platform via `bytedcli safe tcs`.

## Authentication

Requires Safe authentication. See the parent skill `bytedance-safe` for login instructions:

```bash
bytedcli auth login --session
bytedcli safe login
```

## Commands

### project

```bash
# Get TCS project by project id
bytedcli safe tcs project get --project-id <project-id>

# Explicit JSON output
bytedcli --json safe tcs project get --project-id <project-id>

# Update a TCS project's ProductType by migrating it from a target project
bytedcli safe tcs project update_product_type --project-id <project-id> --target-project-id <target-project-id>

# Explicit JSON output
bytedcli --json safe tcs project update_product_type --project-id <project-id> --target-project-id <target-project-id>
```

### trace

```bash
# Get TCS trace of a project by project id
bytedcli safe tcs trace get --project-id <project-id>

# Explicit JSON output
bytedcli --json safe tcs trace get --project-id <project-id>
```

## Options

### project get / trace get

| Option | Default | Description |
|--------|---------|-------------|
| `--project-id <id>` | (required) | TCS project id |

### project update_product_type

| Option | Default | Description |
|--------|---------|-------------|
| `--project-id <id>` | (required) | Source TCS project id whose ProductType will be updated |
| `--target-project-id <id>` | (required) | Target TCS project id whose ProductType will be applied to the source project |

## Output Modes

- **默认文本**: `project get`、`project update_product_type` 与 `trace get` 会输出可读文本；对象结果会渲染成 KV 表。
- **显式 JSON (`--json`)**: 在 `data` 字段返回结构化 JSON，适合脚本消费。

## Common Patterns

**Inspect a project's metadata then pull its trace:**
```bash
bytedcli safe tcs project get --project-id example-project-id
bytedcli safe tcs trace get --project-id example-project-id
```

**Update a project's ProductType to match another project:**
```bash
bytedcli safe tcs project update_product_type \
  --project-id example-source-id \
  --target-project-id example-target-id
```

## References

- [invocation.md](references/invocation.md) — bytedcli 通用调用方式
- [tcs-api.md](references/tcs-api.md) — 命令与 API 映射
- [troubleshooting.md](references/troubleshooting.md) — 常见问题与处理
