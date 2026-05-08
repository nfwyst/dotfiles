---
name: bytedance-aiosandbox
description: "Manage AIO Sandbox environments via bytedcli: create/manage sessions, execute shell commands, manage files, automate browsers, run code (Python/JS), interact with Jupyter/Node.js, record screens, manage skills and hooks."
---

# AIO Sandbox

AIO Sandbox is an All-in-One Agent Sandbox Environment providing containerized Browser, Shell, File System, Code Execution, Jupyter, Node.js, and more.

## How to invoke bytedcli

```bash
npx @bytedance-dev/bytedcli aiosandbox <subcommand> [options]
```

## Access Modes

| Mode | When to Use | Options | Auth |
|------|-------------|---------|------|
| AIPAAS (managed) | Standard workflow | `--session-id <id> --site <site>` | SSO JWT (automatic) |
| Direct | Dev/debug, pre-existing containers | `--url <url> --api-key <key>` | API Key |

## Quick Start

### 1. Create a session (AIPAAS)
```bash
bytedcli aiosandbox session create --psm example.sandbox.psm --ttl 3600
```

### 2. Execute shell commands
```bash
bytedcli aiosandbox shell exec --command "echo hello" --session-id <id>
```

### 3. File operations
```bash
bytedcli aiosandbox file read --path /workspace/main.py --session-id <id>
bytedcli aiosandbox file write --path /workspace/main.py --content "print('hello')" --session-id <id>
bytedcli aiosandbox file upload --local-path ./data.csv --remote-path /workspace/data.csv --session-id <id>
bytedcli aiosandbox file download --remote-path /workspace/output.csv --local-path ./output.csv --session-id <id>
```

### 4. Execute code
```bash
bytedcli aiosandbox code exec --language python --code "print('hello')" --session-id <id>
bytedcli aiosandbox nodejs exec --code "console.log('hello')" --session-id <id>
```

### 5. Browser automation
```bash
bytedcli aiosandbox browser page navigate --page-url "https://example.com" --session-id <id>
bytedcli aiosandbox browser page screenshot --output ./screenshot.png --session-id <id>
bytedcli aiosandbox browser page click --selector "#submit" --session-id <id>
```

### 6. Direct mode
```bash
bytedcli aiosandbox shell exec --command "whoami" --url http://localhost:8080 --api-key demo-key
```

## Command Reference

### Session Management (AIPAAS)
- `session create --psm <psm> [--ttl <s>] [--site <site>]`
- `session list [--psm <psm>] [--site <site>]`
- `session get --session-id <id> [--site <site>]`
- `session update --session-id <id> [--ttl <s>] [--site <site>]`
- `session delete --session-id <id> [--site <site>]`

### Shell (Bash Pipe)
- `shell exec --command <cmd> [--shell-session-id <id>] [--async] [--timeout <s>]`
- `shell output --shell-session-id <id> [--offset <n>] [--wait]`
- `shell write --shell-session-id <id> --input <text>`
- `shell kill --shell-session-id <id> [--signal <sig>]`
- `shell session list | create | close`

### PTY (tmux)
- `pty exec --command <cmd> [--pty-session-id <id>] [--timeout <s>]`
- `pty show --pty-session-id <id>`
- `pty wait --pty-session-id <id> [--timeout <s>]`
- `pty write --pty-session-id <id> --input <text> [--press-enter]`
- `pty kill --pty-session-id <id>`
- `pty session list | create | delete | clear`

### File Operations
- `file read --path <path> [--start-line <n>] [--end-line <n>]`
- `file write --path <path> --content <text> [--file <local>] [--append]`
- `file replace --path <path> --old <text> --new <text>`
- `file search --path <path> --regex <pattern>`
- `file locate --glob <pattern> [--path <dir>]`
- `file grep --pattern <regex> [--path <dir>] [--include <glob>]`
- `file glob --pattern <glob> [--path <dir>]`
- `file list --path <dir> [--recursive] [--show-hidden]`
- `file upload --local-path <path> --remote-path <path>`
- `file download --remote-path <path> --local-path <path>`
- `file watch create | list | delete | poll`

### Browser
- `browser info`
- `browser screenshot [--output <path>]`
- `browser action --type <CLICK|TYPE|SCROLL|...> [--x <n>] [--y <n>] [--text <t>]`
- `browser config [--set <json>]`
- `browser page navigate --page-url <url>`
- `browser page click --selector <sel>`
- `browser page fill --selector <sel> --value <text>`
- `browser page screenshot [--output <path>]`
- `browser page html | text | markdown | elements | wait | tabs | cookies`

### Code Execution
- `code exec --language <python|javascript> --code <code> [--file <path>]`
- `code info`
- `jupyter exec --code <code> [--kernel <name>] [--jupyter-session-id <id>]`
- `jupyter info | session list | create | delete | clear`
- `nodejs exec --code <code> [--version <ver>] [--node-session-id <id>]`
- `nodejs info | session list | create | get | update | delete`

### Other
- `recording start [--fps <n>] | stop | status`
- `skill register --name <n> --file <path> | list | get | delete | clear`
- `info` — Sandbox environment info
- `packages python | nodejs`
- `hook create --name <n> --event <e> --command <c> | list | delete`
- `convert --uri <uri>` — Convert file/URL to markdown

## Sites

| Site | Alias | Description |
|------|-------|-------------|
| cn-north | cn, prod | China North (default) |
| cn-east | cn-e | China East |
| boe | test | BOE test environment |
| i18n-office | i18n | International office |
| i18n-prod | — | International production |

## Notes
- All data-plane commands require `--session-id` or `--url`
- Use `--json` for structured output
- For async shell commands, use `--async` then poll with `shell output --wait`
