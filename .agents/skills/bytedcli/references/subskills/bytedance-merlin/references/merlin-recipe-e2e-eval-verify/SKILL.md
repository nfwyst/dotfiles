---
name: merlin-recipe-e2e-eval-verify
description: End-to-end workflow from writing eval module code in the evals repo to running and verifying on the Seed platform Exercise system. Uses two-phase verification -- fast small-data consistency check, then full-data platform run. Use when the user wants to deploy an eval to the platform, verify an exercise end-to-end, compare local vs platform results, or validate that evals code works on the Seed exercise system.
---

# Evals-to-Exercise Verification

Two-phase workflow: write eval code, verify with small data (local + platform), then run full data on platform.

## Strategy

Do NOT use `max_samples` to create a "small" run -- sampling logic may differ between local and platform, making comparison unreliable. Instead, create two physical datasets:

1. **Small dataset** (~500+ samples, stratified ~20 per task/category) for fast local-vs-platform consistency verification
2. **Full dataset** for the production platform run

Each dataset gets its own DataCard and Exercise Version under the same Exercise. Phase 1 validates code correctness with the small set (minutes). Phase 2 runs the full set on platform only (no local full run needed).

## Prerequisites

- [ ] Eval module code exists under `evals/evals/modules/<name>/` with `exercise.py` and `exercise.yaml`
- [ ] Local entry YAML exists under `evals/entry_scripts/custom/<name>.yaml`
- [ ] Local evaluation runs successfully with a quick smoke test
- [ ] `bytedcli merlin` is installed and authenticated
- [ ] Confirm with user which model to evaluate. Use the user's model SID, for example `<titan_model_sid>`

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
bytedcli auth login
```

## Step 1: Prepare Two Datasets

### 1a. Generate a stratified small dataset

From the full JSONL, sample a small subset that covers every task/category proportionally. For example, with 27 BBH tasks, take ~20 samples per task for ~540 total.

```python
import json, random
from collections import defaultdict

with open("data/<name>_test.jsonl") as f:
    rows = [json.loads(line) for line in f]

by_task = defaultdict(list)
for r in rows:
    by_task[r["task"]].append(r)

PER_TASK = 20
small = []
for task, items in sorted(by_task.items()):
    small.extend(random.sample(items, min(PER_TASK, len(items))))

with open("data/<name>_test_small.jsonl", "w") as f:
    for r in small:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")

print(f"Full: {len(rows)}, Small: {len(small)}")
```

### 1b. Verify both files exist

```bash
wc -l data/<name>_test.jsonl data/<name>_test_small.jsonl
```

## Step 2: Push Code to Remote

The platform clones code from the git remote. The branch and commit **must** exist on the remote.

```bash
git add evals/modules/<name>/ entry_scripts/custom/<name>.yaml tools/prepare_<name>/
git commit -m "feat(<name>): add <name> evaluation module"
git push -u origin <branch>
```

Verify the push and record the **full 40-character** commit SHA:

```bash
git fetch origin <branch> && git log --oneline FETCH_HEAD -3
git rev-parse HEAD
```

**Critical**: Never use abbreviated SHAs. The platform fetches by commit SHA as a ref; short SHAs cause `fatal: couldn't find remote ref` errors.

## Step 3: Upload Both DataCards

Upload both datasets to HDFS, then create DataCards.

```bash
hdfs dfs -mkdir -p hdfs://example-cluster/home/sample/user/<username>/<name>_eval/
hdfs dfs -put data/<name>_test.jsonl       hdfs://example-cluster/home/sample/user/<username>/<name>_eval/
hdfs dfs -put data/<name>_test_small.jsonl hdfs://example-cluster/home/sample/user/<username>/<name>_eval_small/
```

Create DataCards (use `write_mode: "overwrite"` -- `"create"` can fail on first attempt):

```bash
# Full DataCard
bytedcli merlin data upload --database-name test --table-name '<name>_eval' --file-config '{"hdfs_path":"hdfs://example-cluster/home/sample/user/<username>/<name>_eval","hdfs_file_format":"json"}' --write-mode overwrite --datacard-dataset-type eval --wait

# Small DataCard
bytedcli merlin data upload --database-name test --table-name '<name>_eval_small' --file-config '{"hdfs_path":"hdfs://example-cluster/home/sample/user/<username>/<name>_eval_small","hdfs_file_format":"json"}' --write-mode overwrite --datacard-dataset-type eval --wait
```

Record the two table names for the next step.

## Step 4: Create Exercise with Two Versions

```bash
# Create Exercise (one per eval module)
bytedcli merlin exercise create --name '<exercise_name>'
# Record exercise_sid

# Version for small data (Phase 1 verification)
bytedcli merlin exercise create-version --exercise-sid '<exercise_sid>' --name v1-small --warehouse-db test --warehouse-table '<name>_eval_small' --branch '<branch>' --commit-sha '<full_40_char_sha>' --config '{"class": "<eval_class>", "args": {"steps": 256}}'
# Record exercise_version_sid_small

# Version for full data (Phase 2 production)
bytedcli merlin exercise create-version --exercise-sid '<exercise_sid>' --name v1-full --warehouse-db test --warehouse-table '<name>_eval' --branch '<branch>' --commit-sha '<full_40_char_sha>' --config '{"class": "<eval_class>", "args": {"steps": 256}}'
# Record exercise_version_sid_full
```

**Pre-flight checklist**:

- [ ] Branch is pushed to remote
- [ ] Commit SHA is the full 40-character hash
- [ ] `warehouse_table` values match the DataCards from Step 3

## Step 5: Phase 1 -- Small Data Verification

Run **both** local and platform on the small dataset with identical settings.

### 5a. Local run (small data)

Point the local entry YAML at the small JSONL:

```yaml
dataset:
  source_type: file_storage
  sources:
    file_storage:
      - path: data/<name>_test_small.jsonl
        eval_class: <name>
execution:
  max_samples: null   # run ALL samples in the small file
  temperature: 0      # greedy decoding
```

```bash
cd /path/to/evals
python -m evals.cli.entry --config_file entry_scripts/custom/<name>.yaml
```

Record metrics from `outputs/<model>_<timestamp>/metric/report/*_exercise.json`.

### 5b. Platform run (small data)

```bash
bytedcli merlin exercise run --exercise-sid '<exercise_sid>' --exercise-version-sid '<exercise_version_sid_small>' --verified-models '["<titan_model_sid>"]' --evaluation-task-conf '{"model":{"model_provider":"external_api"},"param_mode":"GREEDY"}'
```

> **Known issue**: `bytedcli merlin exercise run` may return exit code 1 with "empty instance" error even when the instance is actually created. This is a backend bug where `create-merlin-seed-exercise-version-instance` returns `code: 0, instance: null`. Use `list-runs` to verify:

```bash
bytedcli merlin exercise list-runs --exercise-sid '<exercise_sid>' --exercise-version-sid '<exercise_version_sid_small>' --creator '<your_username>' --limit 5
```

### 5c. Compare Phase 1 results

Wait for the platform run to reach `DONE`, then compare:

```bash
bytedcli merlin exercise get-result --sid '<instance_sid>'
```

| Metric | Local | Platform | Delta |
|--------|-------|----------|-------|
| macro_accuracy | X.XX | X.XX | X.XX% |
| micro_accuracy | X.XX | X.XX | X.XX% |

**Acceptance criteria**: delta < 1%. With greedy decoding and identical data, differences should be minimal (API-level floating point non-determinism only).

If delta > 1%, debug before proceeding:

1. Is the data identical? Compare sample counts and IDs between local JSONL and DataCard.
2. Is the commit SHA on the exercise version pointing to the correct code?
3. Check inference outputs for answer extraction differences.

## Step 6: Phase 2 -- Full Data (Platform Only)

Once Phase 1 passes, submit the full dataset on platform. No local full run is needed.

```bash
bytedcli merlin exercise run --exercise-sid '<exercise_sid>' --exercise-version-sid '<exercise_version_sid_full>' --verified-models '["<titan_model_sid>"]' --evaluation-task-conf '{"model":{"model_provider":"external_api"},"param_mode":"GREEDY"}'
```

Monitor and get results:

```bash
bytedcli merlin exercise list-runs --exercise-sid '<exercise_sid>' --exercise-version-sid '<exercise_version_sid_full>' --creator '<your_username>' --limit 5

bytedcli merlin exercise get-result --sid '<instance_sid>'
```

Record the full metrics as the production baseline.

## Step 7: Document Results

Update the Feishu report (or create one) with:

- Run configuration (model, temperature, sample counts)
- Phase 1 comparison table (local vs platform on small data)
- Phase 2 full metrics
- Platform resource info (Exercise SID, Version SIDs, Instance SID, DataCard names, commit SHA)
- Any issues encountered

## Failure Diagnosis

When a platform job fails, use `bytedcli merlin` to diagnose:

```bash
bytedcli merlin job get-run --job-run-id '<job_run_id>'

bytedcli merlin job list-trial-exit-info --job-run-id '<job_run_id>' --trial-id '<trial_id>'

bytedcli merlin job list-trial-logs --job-run-id '<job_run_id>' --trial-id '<trial_id>' --filter '{"pod_name":"<pod_name>","log_type":"instance_log"}'

no_proxy=* curl -sS "<stderr_log_url>" | tail -80
```

> **非中国区域 TOS 访问**：如果下载日志时遇到 `tosv.byted.org` 域名无法访问的问题，将 URL 中的 `tosv.byted.org` 替换为 `cdn-tos-cn.bytedance.net` 即可。该域名在全球所有区域可用，无需 CN VPN。参考：[说明文档](https://bytedance.us.larkoffice.com/docx/U6vLdvE1RoLB4lx1RNhubX2NsRf)

Common failure causes:

| Error | Cause | Fix |
|-------|-------|-----|
| `couldn't find remote ref <sha>` | Branch not pushed or short SHA used | Push branch; use full 40-char SHA |
| `Fail to get these git repoes` | Git clone failed | Check branch exists on remote |
| `unexpected end of JSON input` for `ray_init_config.json` | Config file missing in repo | Add required config to the branch |
| 401/403 auth errors | Token expired | `bytedcli auth login` |
| `data upload` fails with `write_mode: "create"` | Table creation race condition | Use `write_mode: "overwrite"` |

## Known Issues

1. **Do NOT set `debug: false` on Merlin devbox**: `evals/cli/entry.py` detects `ARNOLD_WORKSPACE_ID` and auto-enables `DEBUG_MODE=true`, limiting local concurrency to 64. This is intentional -- disabling it (`debug: false`) raises the threshold to 10240, which will OOM-kill Ray workers on devbox. Keep the default `debug: true` (or omit it entirely) for local runs.
2. **`bytedcli merlin exercise run` returns empty instance**: The `create-merlin-seed-exercise-version-instance` API returns `code: 0, instance: null` but actually creates the instance. Always verify with `list-runs` after a failed `exercise run`.

## Critical Rules

1. **Full SHA only**: Always use 40-character commit SHAs for exercise versions.
2. **Push before create**: Verify the branch and commit exist on the remote before creating or updating exercise versions.
3. **CLI first**: Use `bytedcli merlin` for all Seed and Merlin operations.
4. **Verify ownership**: Always check the `creator` field when listing instances.
5. **Don't modify shared configs** (e.g. `ray_init_config.json`) without user permission.
6. **No max_samples for comparison**: Use physically separate small/full datasets instead of `max_samples` to ensure identical data between local and platform.
7. **Greedy for verification**: Always use `temperature=0` / `param_mode: "GREEDY"` when comparing local vs platform results.

## Related Skills

- `merlin-eval-data-upload` -- upload data to DataCard
- `merlin-recipe-eval-exercise-setup` -- create Exercise and Exercise Version
- `merlin-recipe-eval-run` -- submit and monitor evaluations
- `merlin-eval-get-result` -- retrieve evaluation metrics
- `merlin-job-debug` -- diagnose failed platform jobs
