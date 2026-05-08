---
name: bytedance-safe
description: Content moderation platform operations via bytedcli. Router skill for safe domain sub-skills, including puzzle workflows, Safe sample library queries, SafeMind graph lifecycle/testing/trace operations, and Digital Employee workflows.
---

# Safe Domain

Content moderation platform commands for querying features, entities, datasources, tenants, packages, collections, sample libraries, SafeMind graph instances, digital employee graph instances, and more.

## Authentication

Before using any safe command, authenticate first:

```bash
# SSO-based login (requires prior `bytedcli auth login --session`)
bytedcli safe login

# Or paste cookie directly
bytedcli safe login --cookie "session=xxx"

# Or set environment variable
export SAFE_COOKIE="your_cookie_here"
```

## Configuration

Manage tenant, business, and other Safe settings:

```bash
bytedcli safe config get
bytedcli safe config get --key tenant
bytedcli safe config set --key tenant --value sample_tenant
bytedcli safe config clear --key tenant
```

## Sub-Domain Skills

| Sub-Domain       | Skill                              | Description                                                                                                           |
| ---------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| puzzle           | bytedance-safe-puzzle              | Feature platform — features, entities, datasources, tenants, packages, collections                                    |
| hawkpro          | bytedance-safe-hawkpro             | Trace query — list and get hawkpro moderation traces                                                                  |
| sample           | bytedance-safe-sample              | Sample library query workflow via `safe sample list` / `safe sample query_samples`                                    |
| digital-employee | bytedance-safe-digital-employee    | Digital Employee agent lookup, graph validation/update, agent simulation, result queries, and batch tasks             |
| safemind         | bytedance-safe-safemind            | Model list, graph lifecycle/test operations, and trace analysis for AI reasoning engine                               |

Load the corresponding sub-skill for detailed command syntax, parameters, and usage patterns.

## Common Options

- `--tenant <tenant>` — Tenant for API requests. Puzzle sub-commands, digital employee agent lookup, graph validation/update/simulation/result queries, digital employee batch simulation tasks, SafeMind queries, and sample queries support this option. Priority: `--tenant` > `SAFE_TENANT` env > config > default `ecology`.
  - Config: `bytedcli safe config set --key tenant --value <tenant>`
- `--business <business>` — Business ID (default: default)
- `--business-id <id>` / `--business-key <key>` — Sample query business headers. Priority: CLI > env (`SAFE_BUSINESS_ID`, `SAFE_BUSINESS_KEY`) > config (`business_id`, `business_key`).
