# Devbox Command Reference

> All `--vmid` options auto-detect the instance when only one exists.
> Dangerous operations require `--yes` to execute.

## Instance management

### devbox list

List all Devbox instances.

```bash
bytedcli devbox list
bytedcli devbox list --status active
bytedcli --json devbox list
```

| Option | Description |
|--------|-------------|
| `--status <status>` | Filter by status (e.g., active, stopped) |
| `--flavor <flavor>` | Filter by flavor |

### devbox get

Get detailed information about a Devbox instance.

```bash
bytedcli devbox get
bytedcli devbox get --vmid <vmid>
```

| Option | Description |
|--------|-------------|
| `--vmid <vmid>` | Instance ID (optional, auto-detected) |

## SSH & remote execution

### devbox ssh

Interactive SSH login or remote command execution.

```bash
# Interactive login
bytedcli devbox ssh

# Remote command execution
bytedcli devbox ssh --cmd "hostname && uptime"
bytedcli devbox ssh --cmd "cd /project && make build"

# JSON mode — connection info (no --cmd) or structured output (with --cmd)
bytedcli --json devbox ssh
bytedcli --json devbox ssh --cmd "docker ps"
```

| Option | Description |
|--------|-------------|
| `--vmid <vmid>` | Instance ID (optional, auto-detected) |
| `--cmd <command>` | Execute command remotely instead of interactive login |
| `--extra-args <args>` | Extra arguments passed to ssh |
| `--timeout <seconds>` | Timeout in seconds for `--cmd` mode (default: 60) |

**Behavior**:
- Without `--cmd`: spawns interactive `ssh user@ip` with terminal pass-through
- With `--cmd`: runs `ssh user@ip '<command>'`, captures stdout/stderr, propagates exit code
- If SSH fails with Permission denied, auto-runs `kinit` and retries once

### devbox scp

Copy files to/from a Devbox instance. Uploads by default; use `--download` for reverse.

```bash
# Upload local to remote
bytedcli devbox scp ./local/path /remote/path

# Download remote to local
bytedcli devbox scp --download /remote/path ./local/path

# JSON mode — connection info without spawning SCP
bytedcli --json devbox scp ./local/path /remote/path
```

| Option | Description |
|--------|-------------|
| `--vmid <vmid>` | Instance ID (optional, auto-detected) |
| `--download` | Download from remote to local (default is upload) |

**Behavior**:
- Always passes `-r` for recursive directory transfer
- If SCP fails with exit code 255 (auth failure), auto-runs `kinit` and retries once

### devbox ide

Open a remote IDE connection.

```bash
bytedcli devbox ide
bytedcli devbox ide --type cursor
bytedcli devbox ide --type trae
bytedcli --json devbox ide
```

| Option | Default | Description |
|--------|---------|-------------|
| `--vmid <vmid>` | auto | Instance ID |
| `--type <type>` | `vscode` | IDE type: `vscode`, `cursor`, `trae` |

## Dangerous operations (require `--yes`)

### devbox stop

```bash
bytedcli devbox stop --yes
```

### devbox reboot

```bash
bytedcli devbox reboot --yes
```

### devbox rebuild

Reset system disk. With `--full`, wipes all disks.

```bash
bytedcli devbox rebuild --yes
bytedcli devbox rebuild --full --yes
```

| Option | Description |
|--------|-------------|
| `--full` | Wipe system + data disks (default: system only) |

### devbox delete

Permanently delete the instance.

```bash
bytedcli devbox delete --yes
bytedcli devbox delete --vmid <vmid> --yes
```

### devbox resize

Change machine type.

```bash
bytedcli devbox resize --flavor ecs.g3i.2xlarge --yes
```

| Option | Required | Description |
|--------|----------|-------------|
| `--flavor <flavor>` | Yes | Target flavor |

## Snapshot management

### devbox snapshot list / create

```bash
bytedcli devbox snapshot list
bytedcli devbox snapshot create
bytedcli devbox snapshot create --name "before-upgrade"
```

## Volume info

### devbox volume list

Shows data volume type and size.

```bash
bytedcli devbox volume list
```
