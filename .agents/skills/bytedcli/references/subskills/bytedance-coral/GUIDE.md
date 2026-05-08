---
name: bytedance-coral
description: "Use bytedcli Coral commands for metadata lookup and Hive permission workflows: search Coral/Hive assets, inspect table metadata/DDL/partitions/lineage/quality, apply for table or column permissions, answer permission drafts, submit or withdraw applications, and handle Coral-specific permission questionnaire edge cases."
---

# bytedcli Coral

Use this skill when the task mentions Coral, Coral Hive metadata, table search, table/column permission, permission questionnaire, `existed_application_id`, or Coral approval withdrawal.

## Invocation

```bash
bytedcli --json coral <command> [options]
```

In this repo, local testing uses:

```bash
node dist/bytedcli.js --json coral <command> [options]
```

If options are unclear, run `coral --help`, `coral hive table --help`, or `coral permission --help` instead of guessing.

## Quick commands

```bash
# Search tables when only a keyword is known
bytedcli --json coral search --region sg --query "example_table" --type-name HiveTable --limit 10

# Prefer DB-scoped table search when DB is known
bytedcli --json coral hive table list --region sg --db-name example_db --query "example_table" --limit 10

# Inspect metadata
bytedcli --json coral hive table get --region sg --db-name example_db --table-name example_table
bytedcli --json coral hive table ddl --region sg --db-name example_db --table-name example_table
bytedcli --json coral hive table partitions --region sg --db-name example_db --table-name example_table --limit 20

# Apply read permission; repeat --column for column-level access, omit for table-level access
bytedcli --json coral permission apply --region sg --db-name example_db --table-name example_table \
  --column sample_col --auth-object demo-user --permission read --ttl 365 \
  --reason "Need read access for analysis."
```

## Rules that matter

- Use `/tmp` for drafts and debug payloads; do not write scratch files into the repo.
- Do not reuse cookies from browser curl examples; use bytedcli auth/session.
- Permission questions and legal option ids must come from Coral draft/API output. Do not invent schemas or answer ids.
- In real workflows, ask the user before answering permission questions. Only random-answer in explicitly authorized tests.
- `status: existing` / `existed_application_id` is an existing ticket, not a new submission.
- `status: unknown` or no `groupId`/URL means do not claim a new ticket was created.
- If a test creates a ticket id, withdraw it before finishing.

## References

- `references/search-and-metadata.md` — compact metadata command guide.
- `references/permission-workflow.md` — permission draft/create/withdraw flow and gotchas.
- `references/commands.md` — command cheat sheet.
