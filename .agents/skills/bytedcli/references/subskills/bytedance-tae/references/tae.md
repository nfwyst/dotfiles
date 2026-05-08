# TAE / AI PaaS workflow

Prefer first-class `bytedcli tae` commands for Agent, Sandbox, MCP Server, and MCP Tool operations. Use raw API passthrough only when a capability is not covered by the command surface and the user has authorized the action.

## Safety and scope

- Deleting tools, updating MCP servers/tools, and releasing revisions are externally visible; confirm user authorization first.
- Store scratch JSON, generated schemas, and reports under `/tmp/`, not in a source workspace.
- Do not send internal payloads or IDL content to external services.

## Site selection

Use the default `--site` unless the user gives a TAE page from another ByteCloud site or explicitly asks for one.

```bash
bytedcli tae mcp server search --keyword demo-server
bytedcli --site i18n-tt tae mcp server search --keyword demo-server
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli tae mcp server search --keyword demo-server
```

If authentication fails after switching sites, run `bytedcli auth login --site <site>`.

## First-class CLI commands

Use search commands for keyword lookup. Use list commands for unfiltered or explicitly filtered collections.

```bash
bytedcli tae mcp server search --keyword demo-server
bytedcli tae mcp server list --limit 20
bytedcli tae mcp server get --server-id demo-server-id
bytedcli tae mcp server create --payload '{"name":"demo-server"}'
bytedcli tae mcp server update --server-id demo-server-id --payload '{"name":"demo-server"}'
bytedcli tae mcp server release --server-id demo-server-id

bytedcli tae agent search --keyword demo-agent
bytedcli tae agent list --limit 20
bytedcli tae agent get --agent-id demo-agent-id

bytedcli tae sandbox search --keyword demo-sandbox
bytedcli tae sandbox list --limit 20
bytedcli tae sandbox get --sandbox-id demo-sandbox-id

bytedcli tae mcp tool list --server-id demo-server-id
bytedcli tae mcp tool get --server-id demo-server-id --tool-id demo-tool-id
bytedcli tae mcp tool create --server-id demo-server-id --payload '{"tool_name":"demo_tool"}'
bytedcli tae mcp tool update --server-id demo-server-id --tool-id demo-tool-id --payload '{"tool_input_schema":"{}"}'
bytedcli tae mcp tool delete --server-id demo-server-id --tool-id demo-tool-id

bytedcli tae mcp schema generate --idl-file /tmp/service.thrift --method GetSomething --output /tmp/schema.json
bytedcli tae mcp schema update --server-id demo-server-id --dry-run --report /tmp/schema_report.json
bytedcli tae mcp schema update --server-id demo-server-id --report /tmp/schema_report.json --release
```

Common options: `--env prod`, `--region-id bytedance`, and global `--json`.

## Raw API passthrough

Use raw passthrough only after checking `bytedcli tae --help` and confirming there is no first-class command.

```bash
bytedcli tae api get --path /agents
bytedcli tae api update --path /agents/demo-agent-id --payload '{"name":"demo-agent"}'
```

Raw passthrough reuses bytedcli authentication and TAE request headers internally; agents should not hand-roll JWT header examples in normal workflows.

## Schema generation workflow

For RPC tools, prefer generating input schema from Thrift IDL:

1. Run `tae mcp schema generate` for one method or `tae mcp schema update --dry-run` for live tools.
2. Review the report under `/tmp/`.
3. Run `tae mcp schema update --server-id ... --release` only when the user authorizes writing and publishing.
4. Verify live tools after release.

Schema compatibility rule: do not emit empty `format` values.

## Troubleshooting

- `401/403`: check `--site`, refresh login with `bytedcli auth login --site <site>`, then retry.
- Missing resource id: use the corresponding `--server-id`, `--tool-id`, `--agent-id`, or `--sandbox-id` option.
- Empty schema after creation: run schema generation/update from the live tool configuration when IDL is available.
