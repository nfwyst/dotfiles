# Puzzle Usage Guide

## Quick Start

1. Login: `bytedcli safe login`
2. List features: `bytedcli safe puzzle feature list`
3. Get detail: `bytedcli safe puzzle feature get --id <id>`
4. Search features: `bytedcli safe puzzle feature list --keyword <name-or-code>`
5. List tenants: `bytedcli safe puzzle tenant list`
6. List packages: `bytedcli safe puzzle pkg list`
7. List collections: `bytedcli safe puzzle collection list`

## Tips

- Use `-j` flag for JSON output: `bytedcli -j safe puzzle feature list`
- Use `--page` and `--page-size` for pagination
- Use `--keyword` to filter features, packages, or collections by name or code
- Use `--entity-ids` to filter features by entity IDs (e.g., `--entity-ids 123 456`)
- Use `--pkg-code` to filter features by package code
- Use `--production-type` to filter features by production type (e.g., `stats`, `model`, `rpc`)
- Use `--type` to filter datasources by type (e.g., `rpc`, `redis`, `hive`)
- Use `--query` to search datasources by text
- Use `--all` to include test tenants in tenant list
- Use `--exact-match` for exact keyword match in package list
- Use `--related-to-me false` to list all collections, not just yours
- `ds` is a short alias for `datasource`
- `pkg` is a short alias for `package`
- `feature list-dependencies` helps trace downstream definitions and parameters
- `feature get-rule-conf` allows checking production unit rule configuration (supports both `data_source` and `script` types)
- `feature test` can simulate features directly, e.g. `bytedcli safe puzzle feature test --id <id> --entity-params '{"param1": {"type": 4, "val": "foo"}}'`
- `feature create-draft` allows creating draft configurations for both data source (`ds`) and `script` features by parsing JSON files or text inputs.
- `script generate-template` generates common/req/resp templates for script development
- `script compile` allows analyzing Yaegi scripts offline by passing content and linking to entity or collection IDs
- `ticket create` creates a release/urgent ticket for MM features
