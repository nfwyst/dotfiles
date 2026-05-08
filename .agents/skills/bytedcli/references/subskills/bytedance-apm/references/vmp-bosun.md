# Argos VMP Bosun (`apm argos bosun query`)

This reference covers querying VMP (Volcengine Managed Prometheus) data through the Argos `bosun/data` endpoint via `bytedcli apm argos bosun query`.

## Prerequisite: multi-cloud proxy

The Volcengine account that owns the VMP workspace must be joined to the Argos multi-cloud proxy. This is a one-time ticket flow on Argos; once approved, the Argos multi-cloud proxy service account gets read access to that workspace.

If the account is not yet joined you will see:

```
error_code: 41004500
error_type: INVALID_ARGUMENT
error_message: invalid volvano vmp argument, details: 火山账号<id>在多云代理管理中不存在
```

## Two functions: `promql` and `promras`

- `promql('''<promql>''', step, start, end)` — direct VMP query, no PromQL syntax restrictions
- `promras('''<promql>''', step, start, end)` — bosun-side composition; the **top-level function must use a `by` clause**

`step` / `start` / `end` are relative time strings (`30s`, `5m`, `1h`, …) or empty (`""`). They differ from the body's `start_time` / `end_time`, which are unix seconds defining the bosun engine's query window.

## Modes

### Simplified mode

```bash
bytedcli apm argos bosun query \
  --account-id 1234567890 \
  --workspace-id 00000000-0000-0000-0000-000000000000 \
  --prom 'sum(rate(proxy_requests_total{cluster="demo-cluster"}[1m]))' \
  --duration 1h \
  --step 30s
```

The CLI wraps the PromQL into:

```
["accountID=1234567890&workspaceID=00000000-0000-0000-0000-000000000000"]promql('''<your prom>''', "30s", "3600s", "")
```

Switch to `promras` with `--func promras` (remember the top-level `by` clause requirement).

### Passthrough mode

```bash
bytedcli apm argos bosun query \
  --expr-file ./panel.bosun \
  --duration 1h
```

`--expr-file` is the recommended way for `promras` multi-variable compositions and for verbatim copies from a dashboard panel:

```
$error = ["accountID=…&workspaceID=…"]promras('''sum by (cluster) (rate(apiserver_request_total{code=~"50.*"}[5m]))''', "30s", "5m", "1m")
$total = ["accountID=…&workspaceID=…"]promras('''sum by (cluster) (rate(apiserver_request_total{}[5m]))''', "30s", "5m", "1m")
$error_rate = $error / $total
$error_rate
```

## Region: Volcengine vs Argos

Body `--region` is the Volcengine region (`cn-beijing`, `cn-shanghai`, `cn-guangzhou`, …), not the Argos region (`China-North2-Tob`, `China-East2-Tob`, …). The CLI defaults to `cn-beijing` for `cn` site; override with `--region cn-shanghai` etc.

| Volcengine     | Argos              |
| -------------- | ------------------ |
| `cn-beijing`   | `China-North2-Tob` |
| `cn-shanghai`  | `China-East2-Tob`  |
| `cn-guangzhou` | `China-South1-Tob` |

For overseas workspaces use the matching Volcengine region; consult the platform mapping doc for the full list.

## Common errors

| `error_code`                                                      | Cause                                                                       | Fix                                                                                                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `41004500` `missing required parameter: accountID or workspaceID` | Simplified mode missing IDs, or passthrough expression without scope prefix | Provide `--account-id` + `--workspace-id` (simplified), or include `["accountID=…&workspaceID=…"]` in the expression (passthrough) |
| `41004500` `promras query must be an aggregation with by clause`  | Top-level promras function lacks `by (...)`                                 | Add `by (...)` or switch to `promql`                                                                                               |
| `41004500` `火山账号X在多云代理管理中不存在`                      | Account not joined to multi-cloud proxy                                     | Submit the Argos multi-cloud proxy ticket (Feishu doc above)                                                                       |
| `50001009` `query timeout`                                        | VMP backend timed out                                                       | Reduce `--duration`, simplify the PromQL                                                                                           |

## Limits

- Single query window ≤ 14 days
- Cloud monitoring data retained ≤ 60 days
- For windows under 6h the platform fixes the aggregation period at 30s
