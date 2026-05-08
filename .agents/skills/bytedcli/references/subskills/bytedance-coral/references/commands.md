# Coral command cheat sheet

Run `bytedcli coral <subcommand> --help` for exact options. Use `--json` for machine-readable output.

## Top-level

```bash
bytedcli coral --help
bytedcli coral search --help
bytedcli coral hive table --help
bytedcli coral permission --help
```

## Metadata

```bash
# Broad entity search
bytedcli --json coral search --region sg --query "example_table" --type-name HiveTable --limit 10

# DB and table metadata
bytedcli --json coral hive db get --region sg --db-name example_db
bytedcli --json coral hive table list --region sg --db-name example_db --query "example" --limit 10
bytedcli --json coral hive table get --region sg --db-name example_db --table-name example_table

# Table extras
bytedcli --json coral hive table ddl --region sg --db-name example_db --table-name example_table
bytedcli --json coral hive table partitions --region sg --db-name example_db --table-name example_table --limit 20
bytedcli --json coral hive table lineage --region sg --db-name example_db --table-name example_table --direction BOTH
bytedcli --json coral hive table quality --region sg --db-name example_db --table-name example_table
bytedcli --json coral hive table dorado-tasks --region sg --db-name example_db --table-name example_table
```

## Permission

```bash
# Table-level read permission
bytedcli --json coral permission apply --region sg --db-name example_db --table-name example_table \
  --auth-object demo-user --permission read --ttl 365 --reason "Need read access for analysis."

# Column-level read permission; repeat --column or comma-separate values
bytedcli --json coral permission apply --region sg --db-name example_db --table-name example_table \
  --column sample_col --column sample_date --auth-object demo-user --permission read --ttl 365

# Answer draft questions; chain from latest draft output
bytedcli --json coral permission answer --draft-file /tmp/coral-draft.json \
  --question-id <question_id> --answer <user_answer> > /tmp/coral-answered.json

# Submit answered draft
bytedcli --json coral permission create --region sg --draft-file /tmp/coral-answered.json

# Withdraw an existing application
bytedcli --json coral permission withdraw --region sg --id <application_id> --description "Withdraw test application"
```

## Notes

- Supported Coral regions shown by current help: `cn`, `sg`, `gcp`, `va`, `mycis`; default is `sg` for Coral commands.
- For Hive table search, `HiveTable` works as the entity type.
- `permission apply` returns either a submitted/existing/unknown result or `status: draft`; see `permission-workflow.md` for draft handling.
