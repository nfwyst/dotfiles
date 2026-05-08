---
name: bytedance-safe-digital-employee
description: Safe Digital Employee operations via bytedcli safe domain. Use when querying Digital Employee agents, resolving graph instance keys, validating or updating graph instances, running agent simulations, querying simulation results, or creating and listing batch simulation tasks.
---

# Safe Digital Employee

Digital Employee agent 查询、图实例校验/更新、agent 单任务试运行、仿真结果查询，以及飞书表格驱动的批量仿真任务创建与状态查询。

## Authentication

Requires Safe authentication. See parent skill `bytedance-safe` for login instructions.

## Command Root

Use the explicit command root in examples below:

```bash
bytedcli safe digital-employee --help
```

`safe de` is the short alias of `safe digital-employee`.

## Commands

### agent get

Get a Digital Employee agent and its graph instance key.

```bash
bytedcli safe digital-employee agent get --id demo-agent-id
bytedcli --json safe digital-employee agent get --id demo-agent-id
```

Parameters:
- `--id <id>` — Digital Employee agent ID [required]
- `--tenant <tenant>` — Tenant code override

### graph validate

Validate a Digital Employee graph instance.

```bash
bytedcli safe digital-employee graph validate --key demo-employee-key --content-file ./sample-graph.json
bytedcli --json safe digital-employee graph validate --key demo-employee-key --content-file ./sample-graph.json
```

Parameters:
- `--key <key>` — Digital Employee entity key [required]
- `--content-json <json>` / `--content-file <path>` — Graph content JSON object; provide exactly one
- `--template-mapping-json <json>` / `--template-mapping-file <path>` — Optional template mapping JSON object or array
- `--tenant <tenant>` — Tenant code override

### graph update

Update a Digital Employee graph instance.

```bash
bytedcli safe digital-employee graph update --id demo-employee-id --version 1 --content-file ./sample-graph.json
bytedcli safe digital-employee graph update --id demo-employee-id --content-json '{"root":"start","nodes":[],"edges":[]}' --template-mapping-json '[]'
bytedcli --json safe digital-employee graph update --id demo-employee-id --content-file ./sample-graph.json
```

Parameters:
- `--id <id>` — Digital Employee entity ID [required]
- `--version <n>` — Digital Employee entity version (default: `1`)
- `--content-json <json>` / `--content-file <path>` — Graph content JSON object; provide exactly one
- `--template-mapping-json <json>` / `--template-mapping-file <path>` — Optional template mapping JSON object or array
- `--ignore-check-content` — Set `ignore_check_content=true`
- `--tenant <tenant>` — Tenant code override

### simulate run-agent

Run a synchronous agent simulation for one task.

```bash
bytedcli safe digital-employee simulate run-agent --agent-id demo-agent-id --task-id demo-task-id
bytedcli safe digital-employee simulate run-agent --agent-id demo-agent-id --task-id demo-task-id --project-id demo-project-id
bytedcli --json safe digital-employee simulate run-agent --agent-id demo-agent-id --task-id demo-task-id
```

Parameters:
- `--agent-id <id>` — Digital Employee agent ID [required]
- `--task-id <id>` — Safe task ID [required]
- `--project-id <id>` — Safe project ID; when omitted, the command resolves it from `--task-id`
- `--open-pre-label-mock` — Set `is_open_pre_label_mock=true`
- `--tenant <tenant>` — Tenant code override

### simulate list-result

List simulation result cases.

```bash
bytedcli safe digital-employee simulate list-result --sim-id demo-sim-id --page 1 --page-size 20
bytedcli safe digital-employee simulate list-result --sim-id demo-sim-id --project-id demo-project-id --page 1 --page-size 20
bytedcli --json safe digital-employee simulate list-result --sim-id demo-sim-id --page 1 --page-size 20
```

Parameters:
- `--sim-id <id>` — Simulation ID [required]
- `--project-id <id>` — Optional Safe project ID filter
- `--page <n>` / `--page-size <n>` — Pagination for returned result cases
- `--tenant <tenant>` — Tenant code override

### simulate create-batch-task

Create an asynchronous batch simulation task from a Feishu sheet.

```bash
bytedcli safe digital-employee simulate create-batch-task --id demo-agent-id --sheet-url https://example.com/sheets/demo
bytedcli --json safe digital-employee simulate create-batch-task --id demo-agent-id --sheet-url https://example.com/sheets/demo
```

Parameters:
- `--id <id>` — Digital Employee agent ID [required]
- `--sheet-url <url>` — Sheet URL containing task IDs in the first column [required]
- `--rpc-timeout <seconds>` — RPC timeout for the batch task (default: `600`)
- `--case-resource-type <n>` — Case resource type (default: `1`)
- `--tenant <tenant>` — Tenant code override

### simulate list-batch-task

List batch simulation tasks under a Digital Employee agent.

```bash
bytedcli safe digital-employee simulate list-batch-task --id demo-agent-id --page 1 --page-size 10
bytedcli --json safe digital-employee simulate list-batch-task --id demo-agent-id --page 1 --page-size 10
```

Parameters:
- `--id <id>` — Digital Employee agent ID [required]
- `--page <n>` / `--page-size <n>` — Pagination for batch tasks
- `--tenant <tenant>` — Tenant code override

## Output

- Text mode renders a compact human-readable summary or table.
- JSON mode (`-j`/`--json`) returns structured data under the standard bytedcli `data` field.
