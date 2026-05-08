# End-to-End Flamegraph Workflow

This document describes the complete automated workflow for creating, polling, and retrieving CPU flamegraphs from ByteDog.

## Step 1: Determine which TCE site the PSM lives on

```bash
for site in cn i18n-tt ttp-us-limited ttp-eu; do
  count=$(bytedcli --site $site tce instance list --psm <PSM> --env prod --page-size 1 --json 2>/dev/null \
    | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('data',{}).get('page_info',{}).get('total_count',0))" 2>/dev/null)
  [ "$count" -gt 0 ] && echo "$site: $count pods"
done
```

Map TCE site to ByteDog configuration:

| TCE Site | BYTEDCLI_CLOUD_SITE | Console Domain | IDC examples |
|----------|-------------------|----------------|--------------|
| cn | cn | bytedog.bytedance.net | LF, HL |
| i18n-tt | i18n-tt | bytedog-i18n.bytedance.net | MY, SG, USEAST |
| ttp-us-limited | i18n-tt | bytedog-i18n.bytedance.net | USEAST5, USEAST8 |
| ttp-eu | i18n-tt | bytedog-i18n.bytedance.net | NO1A |

## Step 2: Pick a healthy pod

```bash
bytedcli --site <site> tce instance list --psm <PSM> --env prod --page-size 5 --json
```

From the response, use:
- `name` field as the `podname` parameter
- `idc` field as the `idc` parameter

## Step 3: Create flamegraph task

Authentication (JWT) is handled automatically by `bytedcli`. If auth fails, bytedcli will prompt for login.

```bash
bytedcli --site <site> bytedog flamegraph create --pod <pod_name> --idc <IDC> --type cpp --duration 30 --frequency 99 --json
```
```

### Flamegraph type parameter

| Language | `type` value | Notes |
|----------|-------------|-------|
| C++ | `cpp` | Default, uses perf |
| Java | `java` | Uses async-profiler |
| Python | `python` | Optional: `python_subprocess`, `include_idle`, `include_native` |

### CLI options

| Option | Description |
|--------|-------------|
| `--pod <name>` | Target pod name (required) |
| `--idc <idc>` | Pod IDC (required) |
| `--type <type>` | Language type: `cpp`, `java`, `python` (default `cpp`) |
| `--duration <seconds>` | Sampling duration in seconds (default `30`) |
| `--frequency <hz>` | Sampling frequency in Hz (default `99`) |
| `--target <target>` | Target type: `tce`, `k8s`, `machine`, `bytefaas`, `yarn` (default `tce`) |
| `--site <site>` | ByteCloud deployment site: `cn`, `i18n-tt`, etc. (global option, placed before subcommand) |

### Create response

```json
{
  "id": 39418450,
  "status": "INIT",
  "creator": "username",
  "type": "CPU_CPP_FLAMEGRAPH_ON_TCE"
}
```

## Step 4: Poll for completion

Wait ~40 seconds (duration + processing time), then poll:

```bash
bytedcli --site <site> bytedog flamegraph get --id <task_id> --json
```

### Status values

| Status | Meaning |
|--------|---------|
| `INIT` | Task created, not started |
| `RUNNING` | Actively sampling |
| `GOOD` | Completed successfully |
| `BAD` | Failed |

Poll every 10 seconds until terminal state (`GOOD` or `BAD`). Max 5 retries.

### Detail response fields (on GOOD)

| Field | Description |
|-------|-------------|
| `func_rank_url` | Top functions by CPU% |
| `total_func_rank_url` | Total function ranking |
| `perf_script_url` | Raw perf script output (gzipped) |
| `perf_stack_url` | Collapsed stack traces |
| `func_relation_url` | Function call graph (pprof format) |
| `pb_stack_file_url` | Protobuf stack file |
| `hotspot` | Auto-detected hotspot info |
| `conclusion` | AI-generated conclusion |

## Step 5: Present results

- Console URL: `https://<console_domain>/flamegraph/<task_id>`
- The console provides an interactive flamegraph viewer

## Downloading raw data

```bash
bytedcli --site <site> bytedog flamegraph download --id <task_id> --output <path>
```

Output format depends on the site:

| Site | Endpoint | Default extension | Content |
|------|----------|-------------------|---------|
| cn, i18n-tt, i18n-bd, boe, eu-ttp | `/api/v3/flamegraph_protobuf/get` | `.pb` | Protobuf-encoded stack tree |
| us-ttp, us-ttp-bdee, us-ttp-usts | `/api/v2/support/fetch_file_by_url` proxying `perf_stack_url` | `.collapsed.gz` or `.collapsed` | Collapsed stacks (folded format). Gzipped when the proxy returns raw gzip bytes; plain text when it returns `{"data": "..."}` JSON. |

The switch is automatic: when `--site` resolves to a US-TTP tenant, bytedcli calls detail first to grab `perf_stack_url`, then proxies the TOS file through `fetch_file_by_url`. Downstream viewers should consume the collapsed format (e.g. `flamegraph.pl` or `speedscope`). `eu-ttp` is intentionally not auto-switched yet — use `--tce-site` / explicit flags if your task lives on an EU-TTP console.

## Step 6: List flamegraph tasks

```bash
bytedcli --site <site> bytedog flamegraph list --pod <pod_name> --idc <IDC> --json
```

## Other profiling targets

Replace `tce` in the API path for other targets:

| Target | API path | Use case |
|--------|----------|----------|
| `tce` | `/api/v2/cpu/flamegraph/tce/...` | TCE containers |
| `k8s` | `/api/v2/cpu/flamegraph/k8s/...` | Kubernetes pods |
| `machine` | `/api/v2/cpu/flamegraph/machine/...` | Bare metal |
| `bytefaas` | `/api/v2/cpu/flamegraph/bytefaas/...` | ByteFaaS functions |
| `yarn` | `/api/v2/cpu/flamegraph/yarn/...` | YARN containers |
