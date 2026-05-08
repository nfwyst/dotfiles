# Workflows

端到端多步骤网关接入和发布流程的完整可执行命令片段。适用于 AI Agent 把一个新服务从零接入到一次生产发布。

所有示例用 `--gateway-env boe-cn` 演示；生产路径把 `boe-cn` 换成 `prod-cn` / `prod-i18n` 即可。

## A. 新服务接入（register → configure → install plugins → deploy）

### A1. 注册服务（PSM → project）

```bash
# 1. 找目标 project
bytedcli --json lark-devops gateway project list --keyword demo --gateway-env boe-cn
# → 记下 items[*].id

# 2. Dry-run add service
bytedcli --json lark-devops gateway service add \
  --project-id 123 --psm example.service.api --gateway-env boe-cn

# 3. 核对 body.psm + body.project_id 后 live
bytedcli --json lark-devops gateway service add \
  --project-id 123 --psm example.service.api --gateway-env boe-cn \
  --execute --yes-i-know-this-is-live
```

### A2. 导入 IDL 拿到 method 列表

```bash
# 首次导入必须用 overwrite（增量 = 无基线无法增量）
bytedcli --json lark-devops gateway idl import \
  --project-id 123 --psm example.service.api \
  --strategy overwrite \
  --revision master \
  --gateway-env boe-cn \
  --execute --yes-i-know-this-is-live

# 验证 method 列表
bytedcli --json lark-devops gateway idl methods \
  --project-id 123 --psm example.service.api --gateway-env boe-cn
# → items[].method / items[].path

# 查 method 对应的 gateway 内部 method_id（供 plugin 装配）
bytedcli --json lark-devops gateway plugin method list \
  --project-id 123 --psm example.service.api --gateway-env boe-cn
```

### A3. 装配插件

```bash
# 方式 1：per-method config（需要精细化参数时）
bytedcli --json lark-devops gateway plugin method add \
  --project-id 123 --method-id 7 --plugin-id 42 \
  --plugin-name rate-limit \
  --config '[{"name":"qps","value":100}]' \
  --gateway-env boe-cn \
  --execute --yes-i-know-this-is-live

# 方式 2：批量绑定插件套餐
bytedcli --json lark-devops gateway plugin package list \
  --project-id 123 --gateway-env boe-cn
# → 记 package_id

bytedcli --json lark-devops gateway plugin package bind \
  --project-id 123 --package-id 99 --method-ids 7,8,9,10 \
  --gateway-env boe-cn \
  --execute --yes-i-know-this-is-live
```

### A4. 发布

```bash
# 1. Pre-deploy checks
bytedcli --json lark-devops gateway deploy check \
  --project-id 123 --checks config,csrf,acl,feature-tree --mode current \
  --gateway-env boe-cn

# 2. Dry-run create
bytedcli --json lark-devops gateway deploy create \
  --project-id 123 --mode current --remark "initial onboarding" \
  --gateway-env boe-cn

# 3. 人工 review body 后 live
bytedcli --json lark-devops gateway deploy create \
  --project-id 123 --mode current --remark "initial onboarding" \
  --gateway-env boe-cn \
  --execute --yes-i-know-this-is-live
# → records { deploy_id: 7 }

# 4. Watch 到终态
bytedcli --json lark-devops gateway deploy status \
  --project-id 123 --deploy-id 7 --gateway-env boe-cn --watch
# → status: success | failed | pending(timeout)

# 5. 如果过程中卡住，查 stage detail
bytedcli --json lark-devops gateway deploy process \
  --project-id 123 --deploy-id 7 --gateway-env boe-cn
```

## B. 线上快速回滚

触发场景：`prod-cn` 刚发完 deploy-id=31 出问题。

```bash
# 1. 看 deploy 历史确认是上一个稳定版本
bytedcli --json lark-devops gateway deploy list \
  --project-id 123 --page 1 --limit 5 --gateway-env prod-cn
# → 找到 deployment_id=30（上一个 Succeeded）

# 2. Dry-run rollback（先试 runtime，失败再升级到 full）
bytedcli --json lark-devops gateway rollback create \
  --project-id 123 --deployment-id 30 \
  --type runtime \
  --remark "rollback due to P1 incident" \
  --gateway-env prod-cn

# 3. Live
bytedcli --json lark-devops gateway rollback create \
  --project-id 123 --deployment-id 30 \
  --type runtime \
  --remark "rollback due to P1 incident" \
  --gateway-env prod-cn \
  --execute --yes-i-know-this-is-live

# 4. 若 runtime 不够（配置/IDL 也变了），改 full + 可限定 units
bytedcli --json lark-devops gateway rollback create \
  --project-id 123 --deployment-id 30 \
  --type full \
  --rollback-units CN,VA \
  --gateway-env prod-cn \
  --execute --yes-i-know-this-is-live
```

## C. 审批 + 分步确认发布

对走审批流的 deploy：

```bash
# create 后进入 pending-approve
bytedcli --json lark-devops gateway deploy create \
  --project-id 123 --mode current --gateway-env prod-cn \
  --execute --yes-i-know-this-is-live
# → deploy_id

# 查当前 stage
bytedcli --json lark-devops gateway deploy status \
  --project-id 123 --deploy-id 7 --gateway-env prod-cn

# 审批通过当前 stage
bytedcli --json lark-devops gateway deploy approve \
  --project-id 123 --deploy-id 7 --action approve \
  --gateway-env prod-cn \
  --execute --yes-i-know-this-is-live

# 或者确认 / 跳过 / 取消
bytedcli --json lark-devops gateway deploy confirm --project-id 123 --deploy-id 7 --action confirm --gateway-env prod-cn --execute --yes-i-know-this-is-live
bytedcli --json lark-devops gateway deploy skip    --project-id 123 --deploy-id 7 --reason "pre-validated" --gateway-env prod-cn --execute --yes-i-know-this-is-live
bytedcli --json lark-devops gateway deploy cancel  --project-id 123 --deploy-id 7 --gateway-env prod-cn --execute --yes-i-know-this-is-live
```

## D. 故障排查 / 配置比对

```bash
# 当前 config vs 线上（最常用）
bytedcli --json lark-devops gateway diff config \
  --project-id 123 --mode current-vs-online --gateway-env prod-cn

# 某个 snapshot vs 线上（回滚前 sanity check）
bytedcli --json lark-devops gateway diff config \
  --project-id 123 --mode snapshot-vs-online --base-snapshot 42 --gateway-env prod-cn

# 两个 snapshot 对比
bytedcli --json lark-devops gateway diff snapshot \
  --project-id 123 --previous 42 --current 43 --gateway-env prod-cn
```

## Agent 决策默认值

- **`--gateway-env` 缺省**：默认 `boe-cn`，生产前确认 user 期望的 env
- **首次 `idl import`**：强制 `--strategy overwrite`
- **增量 update**：默认 `--strategy increase`
- **rollback 类型**：优先 `runtime`，失败再 `full`
- **deploy --watch**：遇 timeout (`status:pending`) 不要当失败，输出 `retry_hint` 让用户决定是否继续轮询
- **未显式给 `--remark`**：默认不填，live 前让 user 补；生产发布建议强制带 remark

## Error handling

| 错误码 | exit | 典型原因 | Agent 应对 |
|---|---|---|---|
| `LARK_DEVOPS_GATEWAY_AUTH_REQUIRED` | 1 | SSO + Chromium cookie 都没拿到 session | 提示 user 本机 Chrome 登录 `https://lark-devops.bytedance.net` 再重试 |
| `LARK_DEVOPS_GATEWAY_API_ERROR` | 1 | lgw-console 返回非 0 code | 原样回显 `code` / `msg` 给 user，不要重试 |
| `LARK_DEVOPS_GATEWAY_PARSE_ERROR` | 1 | zod schema 不匹配 | 通常是 lgw-console API 变了，升级 bytedcli 或报 issue |
| `LARK_DEVOPS_GATEWAY_VALIDATION_ERROR` | 2 | 参数错（如 `--gateway-env unknown`） | 立即修参数 |
| `LARK_DEVOPS_GATEWAY_LIVE_WRITE_REFUSED` | 2 | `--execute` 没配 `--yes-i-know-this-is-live` | 按提示补 flag |
| `LARK_DEVOPS_GATEWAY_POLL_TIMEOUT` | **0** | `deploy status --watch` 超时 | 输出 `retry_hint`，问 user 是否继续 |
