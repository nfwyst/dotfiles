# TCE

## 站点

```bash
# 列出支持的站点
bytedcli tce list-sites
```

## 服务查询

```bash
# 收藏的服务
bytedcli tce service list --page 1 --page-size 10

# 搜索服务
bytedcli tce service search --keyword "keyword" --env "ppe_xxx" --page 1 --page-size 10

# 获取服务详情（也支持 --psm + 可选 --env）
bytedcli --site cn tce service get <service_id>
bytedcli --site cn tce service get --psm example.service.api --env prod

# 列出服务集群（支持 --service-id 或 --psm）
bytedcli --site cn tce cluster list --service-id <service_id> --page 1 --page-size 10
# 集群列表两种视图（默认聚合 vs. IDC 明细）

# 1）默认视图（聚合，加权汇总，每个集群一行；IDC 列隐藏）
bytedcli --site cn tce cluster list --psm example.service.api --env prod --page 1 --page-size 10
bytedcli --site boe tce cluster list --service-id 234558 --cluster-name tls_mix_proxy_boe --page 1 --page-size 10

# 2）IDC 明细视图（每个集群 × IDC 一行）
bytedcli --site cn tce cluster list --psm example.service.api --env prod --with-idc --page 1 --page-size 10
# 列出 PPE 集群（--env ppe_* 自动推断 PPE 环境，无需显式传 --ppe）
bytedcli --site ttp-us-limited tce cluster list --psm example.service.api --env ppe_rd_test_env --page-size 100
```

### PPE 环境操作流程

PPE 服务的 service ID 与 prod 不同。当 `--env` 值匹配 `ppe` 或 `ppe_*` 时，bytedcli 自动按 PPE 环境查询，无需显式传 `--ppe`。
获取到 PPE service ID 后，其他所有命令（`cluster update`、`deployment list`、`instance list` 等）直接使用 `--service-id` 即可。

```bash
# 第 1 步：用 --env ppe_* 查到 PPE 服务和集群（自动推断 PPE，假设返回 service_id=100343）
bytedcli --site ttp-us-limited tce cluster list --psm example.service.api --env ppe_rd_test_env

# 第 2 步：后续命令直接用 --service-id
bytedcli --site ttp-us-limited tce deployment list --service-id 100343
bytedcli --site ttp-us-limited tce cluster update --cluster-id 305999 --service-id 100343 --update-info-file payload.json --yes
bytedcli --site ttp-us-limited tce instance list --service-id 100343
```

## 集群更新

> **CRITICAL SAFETY RULES — MUST follow ALL steps in order:**
>
> 1. **ALWAYS `--dry-run` first.** Never submit a cluster update without first running `--dry-run` and showing the full request body to the user.
> 2. **ALWAYS ask the user for explicit confirmation** before running the real update (without `--dry-run`). Do NOT proceed based on prior approval or assumptions — ask every time.
> 3. **ALWAYS include ALL existing values** in `update_info`. The API uses **replace semantics** — any field you omit will be wiped. For example, if a cluster has 7 environment variables and you only send 1, the other 6 will be deleted.
> 4. **Before modifying `env_list`**, first retrieve the current environment variables (from TCE console or the cluster detail API) and include every existing variable in your payload, only changing the ones the user asked to modify.
> 5. **`--yes` 必须显式带上才会提交。** 不传 `--yes`（且不传 `--dry-run`）时命令会直接报 `TCE_CONFIRMATION_REQUIRED` 并提示加 `--yes` / `--dry-run`，不会进入交互等待。这使 agent 场景下命令可脚本化；但意味着首次执行前务必按规则 1 先 `--dry-run` 给用户看。

```bash
# Step 1: ALWAYS dry-run first — show the request to the user
bytedcli tce cluster update --cluster-id <cluster_id> --service-id <service_id> --update-info-file payload.json --dry-run

# Step 2: ONLY after user explicitly confirms the dry-run output, submit with --yes
bytedcli tce cluster update --cluster-id <cluster_id> --service-id <service_id> --update-info-file payload.json --yes --note "description of change"

# Step 3 (optional): wait for completion
bytedcli tce cluster update --cluster-id <cluster_id> --service-id <service_id> --update-info-file payload.json --yes --wait --note "description of change"

# 可选参数：--purpose、--delay-online、--pipeline-template、--change-single-dc、--block-delay-config
# 等待参数：--wait-timeout-sec（默认 600）、--poll-interval-sec（默认 5）
```

### US-TTP 自动分发

`/deployment/cluster/update/` 在 US-TTP 被 `bytepaas.gateway.common` 的 OG schema 拦截（`update_info.repo_info.*` 字段未登记）。当站点为 US-TTP (`--site us-ttp*` 或 `--tce-site ttp-us-limited`) 且 **update_info 只包含 `repo_info`（纯版本升级）** 时，`cluster update` 内部自动改走 console 的 pipeline 升级端点 `/deployment/cluster/upgrade/`，无需用户切换命令。其它情况（含 `env_list` / resource / weight 等非版本字段）仍走原 `/update/` 端点——在 US-TTP 上这些字段目前仍受 OG 限制，如需修改请走 console。

```bash
# US-TTP 上纯版本升级 — 自动走 pipeline 端点
bytedcli --site us-ttp tce cluster update --cluster-id 400581289 --service-id 3987 --update-info-file repo_only.json --yes
```

其中 `repo_only.json`：

```json
{
  "repo_info": [
    {"name": "ies/tiktok_plus/tiktok_predict", "version": "2.0.1.5922", "scm_repo_id": "425818", "main_repo": true}
  ]
}
```

**update_info JSON 示例**（修改环境变量 — 注意包含全部已有变量）：
```json
{
  "runtime": {
    "env_list": [
      { "env_name": "DEPLOY_PATH", "env_value": "/opt/tiger/example_bin" },
      { "env_name": "RUNTIME_IDC_NAME", "env_value": "useast5" },
      { "env_name": "SCM_NAME", "env_value": "data.search.example_us" },
      { "env_name": "SCM_VERSION", "env_value": "2.0.3.1752" },
      { "env_name": "SEC_KV_AUTH", "env_value": "1" },
      { "env_name": "START_SCRIPT", "env_value": "bash /opt/tiger/example_bin/runs/tce_run" },
      { "env_name": "TCE_PRELOAD_SCRIPT", "env_value": "preload.sh" }
    ]
  }
}
```

> **WARNING**: `update_info` fields use **replace semantics**. If you modify `env_list`, you MUST include the cluster's complete set of environment variables. Omitted variables will be permanently deleted. Always retrieve the current cluster configuration first, then make targeted changes on top of the full list.

## 集群扩缩容

> **SAFETY RULES — 同 `cluster update`：** ALWAYS 先 `--dry-run` 并展示请求给用户，用户确认后再加 `--yes` 提交；不传 `--yes` / `--dry-run` 时命令会直接报 `TCE_CONFIRMATION_REQUIRED` 中止。

```bash
# Step 1: dry-run 预览（推荐：按 PSM/集群名自动解析 ID 和 IDC）
bytedcli tce cluster scale --psm example.service.api --env prod --cluster-name demo-prod --replicas 2 --dry-run

# Step 2: 用户确认后提交
bytedcli tce cluster scale --psm example.service.api --env prod --cluster-name demo-prod --replicas 2 --yes

# 兼容方式：显式传 ID 和 scale_info 文件
bytedcli tce cluster scale --cluster-id <cluster_id> --service-id <service_id> --scale-info-file scale.json --dry-run

# 可选：等待部署完成
bytedcli tce cluster scale --cluster-id <cluster_id> --service-id <service_id> --scale-info-file scale.json --yes --wait --pipeline-template 400013643

# 输入规则：
# - service 标识：--service-id 或 --psm 二选一
# - cluster 标识：--cluster-id 或 --cluster-name 二选一
# - scale 输入：--replicas 或 --scale-info-file 二选一
# 可选参数：--canary-replicas（默认 0）、--is-reservation、--pipeline-template
# 等待参数：--wait-timeout-sec（默认 600）、--poll-interval-sec（默认 5）
```

**scale_info JSON 示例**（调整各 IDC 副本数）：
```json
{
  "dc_info": [
    { "idc": "us-east1", "count": 5, "quota_op": { "type": "no-process" } }
  ],
  "canary_dc_info": [
    { "idc": "us-east1", "count": 1 }
  ]
}
```

## 服务实例

```bash
# 推荐方式：使用 --psm + --env
bytedcli --site cn tce instance list --psm example.service.api --env prod --ordering -cpu

# 兼容方式：使用 --service-id
bytedcli tce instance list --service-id <service_id> --ordering cpu --page 1 --page-size 10

# 按 node IP 过滤服务实例
bytedcli tce instance list --service-id 234558 --node-ip 10.35.142.21 --force-update --page 1 --page-size 10 --tce-site boe

# 强制刷新缓存
bytedcli tce instance list --psm example.service.api --env prod --force-update

# 获取全部实例（不分页）
bytedcli tce instance list --psm example.service.api --env prod --no-pagination

# 删除指定实例（节点迁移等场景），推荐先 dry-run
bytedcli tce instance delete --cluster-id 123456 --idc sample-idc --pod-name sample-pod-1 --dry-run
bytedcli tce instance delete --cluster-id 123456 --idc sample-idc --pod-name sample-pod-1 --yes --tce-site boe
```

> **CRITICAL SAFETY RULES — `instance delete` MUST follow ALL steps in order:**
>
> 1. **Do not propose or run instance deletion unless the user explicitly asks to delete a specific instance, or the context is clearly an instance/node migration where deleting the instance is part of the migration workflow.** Do not infer delete from broader intents like restart, recover, or troubleshoot.
> 2. **Never delete more than one instance at a time.** If the user wants multiple instances removed, handle them strictly one-by-one, with a fresh checkpoint between each deletion.
> 3. **ALWAYS `--dry-run` first** and show the exact `cluster-id`, `idc`, and `pod-name` that would be deleted.
> 4. **ALWAYS get a second explicit confirmation before the real delete.** One confirmation is for target identity; a second confirmation is for executing the deletion now.
> 5. **Before deleting, re-check that the target pod still exists and is unique** via `instance list` or `instance search`. Never delete based on stale output alone.
> 6. **Before deleting, check remaining capacity and health.** If you cannot confirm that enough healthy replicas remain after deletion, especially in prod or low-replica services, stop and surface the risk first.
> 7. **After deleting, re-list instances and inspect status before taking any further action.** If the service does not recover as expected, do not continue with any second deletion.
> 8. **Do not overlap instance deletion with cluster update / scale / deployment changes.** If another change is in flight, warn about compounded risk before proceeding.

## Relay WebShell

```bash
# 先生成浏览器态 SSO session，再直接从 PSM/env 建连
bytedcli auth login --session
bytedcli tce webshell open --psm example.service.api --env prod --first
bytedcli tce webshell exec --session-id ws_xxx --command 'hostname; date'
bytedcli tce webshell interactive --psm example.service.api --env prod --first

# 保存输出到本地文件
bytedcli tce webshell exec --session-id ws_xxx --command-file /tmp/diag.sh --output-file /tmp/diag.out
```

## 发布工单

```bash
# 查询发布工单列表（按服务 ID + 类型筛选）
bytedcli tce deployment list --service-id <service_id> --type upgrade
bytedcli tce deployment list --psm example.service.api --env prod --type upgrade

# 按状态筛选
bytedcli tce deployment list --service-id <service_id> --status finished --page 2

# 获取发布工单详情（返回 meta + pipeline stages + runtime）
bytedcli tce deployment get <deployment_id>

# 跨站点查询工单
bytedcli --site boe tce deployment list --service-id <service_id>
bytedcli --site byteintl tce deployment get <deployment_id>

# us-ttp 专用：在 USTS Review 步骤选择 USTS-NOC 作为 TTP 审批人并确认
# 对应 UI "操作 → 选择TTP审批人 → 弹窗选 USTS-NOC → 确定"，仅 us-ttp 租户下的部署会有该动作
# 不传 --step-id 时，会自动根据 deployment 详情定位含 choose_ttops_approver 的 ConfirmStep
bytedcli --site us-ttp tce deployment select-ttops-approver "https://cloud-ttp-us.bytedance.net/tce/deployment_new/<deployment_id>?service_id=<service_id>"
bytedcli --site us-ttp tce deployment select-ttops-approver <deployment_id> --step-id <step_id>
```

## 环境级联查询

```bash
# 查询 PSM 的环境级联信息
bytedcli tce env-cascader --psm example.service.api

# 指定分区
bytedcli tce env-cascader --psm example.service.api --partition CN

# 指定环境
bytedcli tce env-cascader --psm example.service.api --env prod

# 排除分区
bytedcli tce env-cascader --psm example.service.api --excluded-partitions SG,VA
```

## 泳道部署

```bash
# 部署泳道
bytedcli tce deploy-lane \
  --env ppe_demo \
  --standard-env online_cn \
  --psm example.service.api \
  --flow-base prod \
  --branch master

# 部署指定 SCM 版本（仅提交指定仓库，不携带完整 SCM 列表）
bytedcli tce deploy-lane \
  --env prod \
  --standard-env boe \
  --psm example.service.api \
  --flow-base boe \
  --scm-repo-name example/service/api \
  --scm-repo-version 1.0.0.8 \
  --action upgrade

# 创建时注入自定义环境变量（逗号分隔 key=value）
bytedcli tce deploy-lane \
  --env boe_demo \
  --standard-env boe \
  --psm example.service.api \
  --action create \
  --cluster-names default \
  --env-vars "scmVersion=1.0.0.100"

# 升级时设置自定义环境变量
bytedcli env service upgrade-tce \
  --psm example.service.api \
  --env boe_demo \
  --standard-env boe \
  --cluster-id 12345 \
  --env-vars "scmVersion=1.0.0.100"
```

`--env-vars` 支持逗号分隔的多个键值对，如 `--env-vars "key1=val1,key2=val2"`。值会合并到集群的 `new_env_vars` 中，不会覆盖未指定的已有环境变量。

## 跨站点示例

```bash
bytedcli --site boe tce service search --keyword "my-service"
bytedcli --site byteintl tce service search --keyword "my-service"
bytedcli --site ttp-us-limited tce service search --keyword "my-service"
bytedcli --site ttp-eu tce service search --keyword "my-service"
```

## Notes

- 站点别名：`prod=cn`、`i18n=byteintl`、`tx-ttp=ttp-us-limited`、`eu-ttp=ttp-eu`
- `cluster update` 的 `--update-info-file` JSON 为替换语义；修改 `env_list` 等字段时必须包含全部值，否则覆盖已有配置；`tce cluster edit` 为隐藏别名
- `service get`、`cluster list`、`deployment list` 都支持 `--psm`；如果同一 PSM 在多个 env 下都有服务，可加 `--env` 做唯一定位
- `cluster list --cluster-name` 可按集群名过滤结果；当同一 vregion 下存在多个同名集群时，建议和 `--service-id` 或 `--psm --env` 一起使用
- `instance list` 推荐使用 `--psm + --env`；兼容方式也支持 `--service-id`
- `instance list --node-ip` 可按 node IP 过滤服务实例；仅支持和 `--service-id` 或 `--psm --env` 一起使用，不支持 `--cluster-id`
- `instance list` 的文本表格会展示 `IDC` 列；按 `--node-ip` 排查时可直接看到实例所在机房
- `instance delete` 需要同时传 `--cluster-id`、`--idc`、`--pod-name`；推荐先 `--dry-run` 输出请求，再决定是否执行。默认要求交互确认，非交互场景可显式加 `--yes`
- `--ordering` 可选值：`cpu/-cpu/mem/-mem/idc/-idc/createtime/-createtime/podstatus/-podstatus`；`-` 前缀表示倒序，不带 `-` 表示升序
- `tce webshell` 提供 `open/exec/close/shell` 四个子命令；其中 `open` 先基于 `--psm --env` 建立并持久化会话，`exec` 通过 `--session-id` 执行命令，`close` 删除本地会话，`shell` 用于完整交互态；执行前需要先通过 `auth login --session` 准备本地浏览器态 SSO session
- `tce webshell exec` 每次会重新建立 websocket，因此不会保留上一次命令的 cwd / export / alias；如果需要完整交互态，仍然使用 `tce webshell interactive`
