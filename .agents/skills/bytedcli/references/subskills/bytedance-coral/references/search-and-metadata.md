# Coral search and metadata

Use this when the user asks to find a table or inspect Coral Hive metadata.

## Search choice

```bash
# Free-form search across Coral entities
bytedcli --json coral search --region sg --query "example_table" --type-name HiveTable --limit 10

# Better when DB is known
bytedcli --json coral hive table list --region sg --db-name example_db --query "example_table" --limit 10
```

I tested both patterns locally against Coral; `HiveTable` is accepted by `coral search`, and DB-scoped `table list` is the cleaner path when the database is known.

## Inspect a table

```bash
bytedcli --json coral hive table get --region sg --db-name example_db --table-name example_table
bytedcli --json coral hive table ddl --region sg --db-name example_db --table-name example_table
bytedcli --json coral hive table partitions --region sg --db-name example_db --table-name example_table --limit 20
bytedcli --json coral hive table lineage --region sg --db-name example_db --table-name example_table --direction BOTH
bytedcli --json coral hive table quality --region sg --db-name example_db --table-name example_table
bytedcli --json coral hive table dorado-tasks --region sg --db-name example_db --table-name example_table
```

## Agent guidance

- Prefer explicit `--region`; default is currently `sg`, but explicit region keeps repeated calls stable.
- Use `--json` when the result will be parsed or used to drive another step.
- If output is huge, query only the command needed rather than dumping every metadata endpoint.
