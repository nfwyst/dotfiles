# bytedcli Merlin Reference

Merlin commands include generated native wrappers for Merlin MCP tools plus richer hand-written workflows.

Generated MCP-backed commands follow `bytedcli merlin <group> <command>` and expose JSON Schema fields as normal CLI options. Use them for surfaces such as `devbox`, `arena`, `exercise`, `collection`, `data`, `model`, `checkpoint`, `service`, `pipeline`, and `trigger`.

Rich hand-written workflows cover:

- `job`: list job runs, resolve a job to trial ids, extract a submit-ready YAML from an existing job, then submit that YAML again
- `trial`: diagnose one trial or read one trial's local training log
- `logs`: read stdout/stderr log lines for trials under a Merlin job; CN uses Streamlog and i18n / row sites use Merlin trial log URLs
- `tracking`: read projects, runs, metric names, scalar series, and job-to-tracking links
- `quota`: read groups and clusters through `merlin quota`

## Table of Contents

- [Environment selection](#environment-selection)
- [Site mapping commands](#site-mapping-commands)
- [Job](#job)
- [Trial](#trial)
- [Logs](#logs)
- [Tracking](#tracking)
- [Quota](#quota)
- [Generated MCP-backed commands](#generated-mcp-backed-commands)
- [Authentication](#authentication)
- [JSON output](#json-output)

## Environment selection

- Use global `--site` and optional `--vregion` to choose the Merlin environment.
- Merlin supports these canonical sites: `cn`, `i18n-bd`, `i18n-tt`, `eu-ttp`, `us-ttp-bdee`, `us-ttp-usts`.
- Only `cn` and `i18n-bd` accept `--vregion seed`.
- Merlin does not support `--vdc`. Passing a non-empty `--vdc` returns an input error.
- `list-sites` defaults to `Site | VRegion | VDC | Remark | Origin | API Root`; `job list-sites` additionally prints `Job Core API Root`, `Job Trials API Root`, and `Job Trials Fallback API Root`.
- Unset `vregion` and `vdc` values are rendered as the literal string `null`.
- Bare job ids and direct trial ids use the current global Merlin environment. Full Merlin URLs use the URL host embedded in the input.

## Site mapping commands

```bash
bytedcli merlin job list-sites
bytedcli merlin trial list-sites
bytedcli merlin logs list-sites
bytedcli merlin tracking list-sites
bytedcli merlin quota list-sites
```

`API Root` is surface-specific:

- `job`: `${origin}/api/v1`; `job list-sites` also exposes `job_core_api_root`, `job_trials_api_root`, and `job_trials_fallback_api_root`
- `trial`: `${origin}/arnold/api/v3`
- `logs`: `${origin}/api/training/merlin_job/log/streamlog`
- `tracking`: `${origin}/open`
- `quota`: `${origin}/arnold/api/v3`

## Job

List job runs or resolve trial ids:

```bash
bytedcli merlin job list
bytedcli merlin job list --status running,failed --keyword proposal --page-size 50
bytedcli merlin job list --queued --page-size 50
bytedcli merlin job trials --job <job-id-or-url>
```

Extract submit-ready YAML from a Merlin job id or full job URL:

```bash
bytedcli merlin job extract --job <job-id-or-url>
bytedcli --site cn --vregion seed merlin job extract --job <job-run-id>
bytedcli merlin job extract --job "https://example.merlin.site/development/instance/jobs/<job-run-id>" --output ./trial.yaml
```

Submit a Merlin job from a local YAML file:

```bash
bytedcli merlin job submit --body-file ./trial.yaml
bytedcli --site i18n-bd --json merlin job submit --body-file ./trial.yaml
```

Notes:

- `job list` defaults to the current authenticated username and matches the web page's MINE semantics.
- Use `job list --queued` when checking where submitted jobs are queued. The web page's queued state can appear as job core `STARTED` plus `meta.arnoldTrialStatus=queued`, so filtering only `--status waiting,pending,running` can miss queued jobs.
- `job trials` first queries `/arnold/api/v3/trials/basic?custom_id=<job-id>` to enumerate Arnold trials attached to the Merlin job run.
- If that Arnold lookup returns no trials, `job trials` falls back to `/api/v1/job_run/get/<job-id>` and extracts non-empty, non-zero trial ids from the current job record.
- `job extract --job <job-run-id>` uses the current global Merlin environment.
- `job extract --job <full-url>` uses the URL host instead.
- `job submit` sends the YAML to the resolved job API Root and returns the new job URL.

## Trial

Diagnose a trial or read its local training log:

```bash
bytedcli merlin trial list-sites
bytedcli merlin trial diagnose --trial-id <trial-id>
bytedcli merlin trial local-log --trial-id <trial-id>
bytedcli merlin trial local-log --trial-id <trial-id> --stream stderr --tail 200
bytedcli merlin trial stream-log --trial-id <trial-id> --stream stderr --tail 200
```

Notes:

- `trial diagnose` uses the Arnold-backed trial diagnose endpoint and is mainly useful for scheduling, quota, or queue-related diagnosis.
- When the backend has no active scheduling diagnosis for the trial, the response may only contain `DiagnosticCode: 0` with an empty `DiagnosticInfo` and null `QueueInfo`.
- `trial list-sites` currently shows the same Arnold root mapping family as `quota list-sites`.
- `trial local-log` uses Arnold `instances` + `locallog`, not Streamlog.
- `trial local-log --stream` only accepts `stdout` or `stderr`.
- `trial stream-log` uses the Streamlog backend (alias of `merlin logs get --trial-id`); same options as `logs get`.
- `local-log` and `stream-log` are independent backends; both work at any time but each may miss logs the other has — try the other if the first comes back empty.

## Logs

Query stdout/stderr logs by job or by trial:

```bash
bytedcli --site cn merlin logs list-sites
bytedcli merlin logs get --job <job-run-id>
bytedcli merlin logs get --job "https://example.merlin.site/development/instance/jobs/<job-run-id>?trialId=<trial-id>&tabState=log" --stream stderr --tail 50
bytedcli merlin logs get --trial-id <trial-id> --stream stderr --pod-name <kubernetes-pod-name> --tail 50
bytedcli merlin logs get --trial-id <trial-id> --stream both --all-instances --all
bytedcli --json merlin logs get --job <job-run-id> --role-name <role-name>
bytedcli --site i18n-tt merlin logs get --job <job-run-id> --debug-request
bytedcli merlin logs stream --job <job-run-id> --stream stderr --tail 50
bytedcli merlin logs stream --trial-id <trial-id> --stream stderr --tail 200
BYTEDCLI_NETWORK_PROFILE=prod bytedcli --site i18n-tt merlin logs get --job <job-run-id> --stream stderr --tail 50
```

Key options:

- `--job <jobIdOrUrl>`
- `--trial-id <id>`
- `--stream <stdout|stderr|both>`
- `--tail <n>`
- `--all`
- `--role-name <name>`
- `--instance-id <id>`
- `--pod-name <name>`
- `--all-instances`
- `--debug-request`

Notes:

- `--job` and `--trial-id` are mutually exclusive.
- `--instance-id` and `--all-instances` are mutually exclusive.
- When exact backend alignment matters, prefer `--pod-name`.
- `logs list-sites` shows the Streamlog API Root, not the job API Root.
- For i18n / row logs, bytedcli uses the Merlin `list-trial-logs` URL workaround: retrieve stdout/stderr log-proxy URLs, rewrite internal hosts to the matching public row endpoint, then download the selected URL. For SG/row use `ml-i18n.tiktok-row.net` / `tosv-sg.tiktok-row.org`; do not rewrite SG logs to `cdn-tos-cn`.
- Under `BYTEDCLI_NETWORK_PROFILE=prod` (production network, e.g. dev hosts in VA), `logs get` and other MCP-backed commands keep using MCP — bytedcli auto-swaps the i18n-tt MCP host to a prod-friendly DNS (same service; MCP becomes reachable from prod networks). Office network and `cn` site behavior unchanged.
- `merlin trial stream-log` always uses Streamlog `query_batch_ids` + `by_batch_ids` directly (independent of MCP); it's the explicit "use Streamlog backend" entry point.
- `merlin logs stream` calls MCP `get_job_stream_log` — same options as `logs get`, but returns indexed StreamLog entries instead of trial-log file URLs. Use it when you want StreamLog content via MCP (vs `trial stream-log` which uses Streamlog HTTP directly).
- Use `--debug-request` to print sanitized HTTP requests and curl equivalents for the actual log lookup/download path.

## Tracking

List or read tracking projects:

```bash
bytedcli merlin tracking project list --keyword demo --limit 5
bytedcli merlin tracking project get --project-name demo-project
bytedcli merlin tracking project get --project-id <project-id>
```

List or read runs:

```bash
bytedcli merlin tracking run list --project-name demo-project --limit 10
bytedcli merlin tracking run get --project-name demo-project --run-id <run-id>
bytedcli merlin tracking run entity-names --project-name demo-project --run-id <run-id>
bytedcli merlin tracking run scalar list --project-name demo-project --run-id <run-id> --name train/loss,val/loss
```

Resolve tracking links from a Merlin job run id:

```bash
bytedcli merlin tracking job links --job-run-id <job-run-id>
```

Notes:

- `tracking run scalar list` reads scalar data from `${origin}/open/tracking`.
- Use `--project-id` or `--project-name` as the project selector, depending on the subcommand.
- `job links` is the fastest path when you only have a Merlin job run id.

## Quota

List visible group memberships:

```bash
bytedcli merlin quota group list
bytedcli merlin quota group list --approved-only
```

Read one group's cluster-level resources:

```bash
bytedcli merlin quota group resources --group-id <group-id>
```

List clusters:

```bash
bytedcli merlin quota cluster list
```

Notes:

- `quota group list` returns membership rows.
- `group resources` expects `group.id`, not `group.name`.

## Generated MCP-backed commands

Use generated commands when the richer sections above do not cover the requested Merlin surface. They use the same shared bytedcli auth path and do not shell out to `bytedcli merlin` at runtime.

```bash
bytedcli merlin devbox list
bytedcli merlin devbox get --resource-id <resource-id>
bytedcli merlin job get-run --job-run-id <job-run-id> --dry-run
bytedcli merlin data list --catalog seed --page 1 --page-size 20
bytedcli merlin arena get-evaluation --sid <arena-evaluation-sid>
```

Rules:

- Required schema fields are documented in command Notes.
- Primitive fields become `--kebab-case` options.
- `page_num` / `page_number` are exposed as `--page` when there is no native `page` field; if both exist, `page_number` stays `--page-number` to avoid ambiguous options.
- Object and array fields are passed as JSON for that specific option only.
- `--arg key=value` parses `true`, `false`, `null`, numbers, quoted JSON strings, objects, and arrays before sending raw MCP arguments.
- Use `--schema` to inspect the bundled schema and `--dry-run` to preview the MCP call without executing it.
- MCP-backed generated commands currently support `--site cn`, `--site cn --vregion seed`, `--site i18n-tt`, `--site i18n-bd`, and `--site i18n-bd --vregion seed`. Unsupported Merlin sites fail fast instead of falling back to CN.

Generated command index:

| Group | Common commands |
| --- | --- |
| `arena` | `get-evaluation`, `list-case`, `create-evaluation`, `create-eval-result-export-job` |
| `checkpoint` | `list-ckpt-dirs`, `list-ckpts`, `get-dir`, `get-step` |
| `collection` | `list`, `get`, `create`, `create-version` |
| `data` | `list`, `get`, `get-data-preview`, `get-field-stat` |
| `devbox` | `list`, `get`, `create`, `execute-script`, `get-logs` |
| `eval` | `list-sequence-job`, `get-sequence-job`, `enable-companion-job`, `disable-companion-job` |
| `exercise` | `list`, `get`, `create`, `create-version` |
| `insight` | `get`, `create`, `get-ability`, `get-significance` |
| `job` | `get-run`, `create-run`, `fork-run`, `get-timeline`, `get-grafana` |
| `model` | `list`, `get`, `get-v2`, `list-v2`, `create-idc-sync-job` |
| `pipeline` | `list-def`, `get-def`, `list-run`, `get-run`, `retry-run` |
| `profiling` | `list`, `get`, `get-tos-link` |
| `service` | `list`, `get`, `get-seed-template`, `create-instant-deployment` |
| `tracking` | `get-project`, `list-projects`, `get-run`, `list-runs`, `get-timeseries` |
| `trigger` | `list-def`, `get-def`, `list-run`, `reset-status` |

Readonly devbox check:

```bash
bytedcli --json merlin devbox list
bytedcli --json merlin devbox get --resource-id <resource-id>
```

## Authentication

- Merlin reuses `bytedcli auth login` state and the current ByteCloud JWT flow.
- In normal usage, set `--site` and optional `--vregion`; do not pass `--auth-site` unless you need to override the default auth environment explicitly.

## JSON output

- Prefer `bytedcli --json merlin ...` when another tool needs machine-readable output.
- Merlin JSON payloads now expose canonical environment fields: `site`, `vregion`, `vdc`, `origin`, and `api_root`.
