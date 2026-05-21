---
name: bytedance-janus-mini
description: "Manage Janus Mini swimlanes (泳道), IDL versions, API endpoints, backends, config, and groups via bytedcli. Use when tasks mention Janus Mini, Janus Mini BOE, swimlane, lane create/delete/publish, IDL version update, endpoint management, backend service, config get, or Janus Mini group search."
---

# bytedcli Janus Mini

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要鉴权的命令先登录：`bytedcli auth login`
- 生产 / PPE 命令使用 ByteDance SSO 登录态；如果登录态过期，执行 `bytedcli auth login`
- BOE 命令使用 BOE/test SSO 登录态；如果只登录过生产环境，先执行 `bytedcli --site boe auth login`
- Janus Mini site 选项遵循 bytedcli 全局站点语义：`--site cn`（生产 / PPE 网关）或 `--site boe`（BOE 网关）；`prod` 只作为兼容别名，不在新示例中推荐
- CLI 命令域为 `janus-mini`；所有命令默认走 Janus Mini 网关
- `--mini` 是兼容旧调用的 no-op，不需要主动添加

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## When to use

- 泳道（swimlane）创建、删除、发布、查询
- Janus Mini group 搜索和信息查询
- 在线配置 / stash 配置查询
- IDL 版本查询和更新
- API endpoint 和 backend 创建/更新
- 查询 BAM IDL 版本和方法列表

## 鉴权与路由

- Janus Mini 命令使用 ByteCloud JWT 鉴权，不依赖浏览器 Cookie 或 OpenCLI 登录态。
- `--site cn` 使用 ByteDance SSO（`sso.bytedance.com`）登录态，并换取生产站点 ByteCloud JWT；旧脚本里的 `--site prod` 会兼容映射到 `cn`。
- `--site boe` 使用 BOE/test SSO（`test-sso.bytedance.net`）登录态，并换取 BOE 站点 ByteCloud JWT。
- 操作生产 / PPE 网关前可用 `bytedcli auth status` 检查登录态；过期时执行 `bytedcli auth login`。
- 操作 BOE 前可用 `bytedcli --site boe auth status` 检查登录态；过期时执行 `bytedcli --site boe auth login`。
- 所有 Janus Mini API 通过 ByteCloud 网关访问：`cn` 走 `cloud.bytedance.net`，`boe` 走 `cloud-boe.bytedance.net`。
- 如果 Janus Mini BOE 请求返回 401，先确认命令是否带了 `--site boe`，以及是否已经执行 `bytedcli --site boe auth login`。

## Quick start

Commands are grouped under `janus-mini lane`, `janus-mini group`, `janus-mini config`, `janus-mini idl`, `janus-mini endpoint`, and `janus-mini backend`.

```bash
# ===== 泳道管理 =====
# 列出某 PSM 的所有泳道
bytedcli janus-mini lane list --psm example.psm

# 创建泳道（从 master 复制，7 天 TTL）
bytedcli janus-mini lane create --psm example.psm --lane ppe_example_lane --from-lane master --days 7

# 在 BOE 创建泳道
bytedcli janus-mini lane create --psm example.psm --lane boe_example_lane --from-lane prod --days 3 --site boe

# 删除泳道
bytedcli janus-mini lane delete --psm example.psm --lane ppe_example_lane

# 创建发布 workflow（不代表发布已经完成）
bytedcli --json janus-mini publish create --psm example.psm --lane ppe_example_lane

# 查询发布 workflow
bytedcli janus-mini publish list --psm example.psm --lane ppe_example_lane --workflow-id 123

# 推进发布 workflow（例如进入灰度发布，指定比例 100%）
bytedcli janus-mini publish advance --psm example.psm --lane ppe_example_lane --workflow-id 123 --status graying --gray-mode ratio --gray-ratio 100

# 按 Janus Mini workflow 状态继续推进
bytedcli janus-mini publish advance --psm example.psm --lane ppe_example_lane --workflow-id 123 --status canary
bytedcli janus-mini publish advance --psm example.psm --lane ppe_example_lane --workflow-id 123 --status single
bytedcli janus-mini publish advance --psm example.psm --lane ppe_example_lane --workflow-id 123 --status all
bytedcli janus-mini publish advance --psm example.psm --lane ppe_example_lane --workflow-id 123 --status fulling
bytedcli janus-mini publish advance --psm example.psm --lane ppe_example_lane --workflow-id 123 --status finished

# ===== Group 管理 =====
# 搜索 group（收藏 / 全部）
bytedcli janus-mini group list --psm example.psm
bytedcli janus-mini group list --mode favorite
bytedcli --json janus-mini group list --psm example.psm --site cn
bytedcli --json janus-mini group list --psm example.psm --site boe

# ===== 配置管理 =====
# 查询线上配置（默认 lane=prod）
bytedcli janus-mini config get --psm example.psm

# 查询泳道 stash 配置
bytedcli janus-mini config get --psm example.psm --lane ppe_example_lane

# ===== IDL 版本管理 =====
# 查询 BAM IDL 版本列表
bytedcli janus-mini idl versions --psm example.psm

# 更新泳道 IDL 版本
bytedcli janus-mini idl update --psm example.psm --lane ppe_example_lane --version 1.0.155

# 查询某版本的 IDL 方法
bytedcli janus-mini idl methods --psm example.psm --version 1.0.155

# ===== Endpoint 管理 =====
# 创建 endpoint
bytedcli janus-mini endpoint create --janus-group example.psm --janus-lane ppe_example_lane --endpoint /api-gateway/svc/method

# 查询泳道内 endpoint
bytedcli janus-mini endpoint list --janus-group example.psm --janus-lane ppe_example_lane

# 更新 endpoint
bytedcli janus-mini endpoint update --id 1 --mid 123 --endpoint-id 1 --method POST --endpoint /api/svc/method --janus-group example.psm --janus-lane ppe_example_lane

# ===== Backend 管理 =====
# 为 endpoint 创建 backend
bytedcli janus-mini backend create --eid 123 --url-pattern /api-gateway/svc/method --method ANY --idl-version 1.0.0 --rpc-method GetUser --service backend.psm --janus-group group.psm --janus-lane ppe_example_lane

# 更新 backend
bytedcli janus-mini backend update --id 456 --eid 123 --url-pattern /api-gateway/svc/method --method ANY --idl-version 1.0.0 --rpc-method GetUser --service backend.psm --janus-group group.psm --janus-lane ppe_example_lane

# 查询 common arg
bytedcli janus-mini common-arg query --mid 123 --janus-group example.psm --janus-lane prod
```

## Notes

- 需要结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json janus-mini lane list --psm example.psm`）
- Janus Mini site 通过 `--site cn` 或 `--site boe` 指定；不传时继承全局 `--site` / `BYTEDCLI_CLOUD_SITE`，`prod` 作为兼容别名映射到 `cn`
- `--site` 表示 Janus Mini 网关站点，不是泳道名或发布环境名。不要把 PPE 这类目标写成 `--site ppe`；这类目标应按平台配置体现在 `--lane` / `--from-lane`，并使用默认 `cn` 站点或显式 `--site cn`
- `janus-mini` 命令域默认使用 Janus Mini；`--mini` 仅为兼容旧调用保留
- `lane create` 必须指定 `--from-lane`（源泳道）和 `--days`（TTL 天数）；命令提交创建请求后返回，endpoint 会从源泳道异步复制。用 `lane list` 查看 `pipeline_run_status`（8 表示复制 pipeline 完成），用 `endpoint list` 查看目标泳道 endpoint 是否已经可见
- 创建泳道后，在 endpoint 复制完成前不要假设目标泳道配置已经稳定；需要新增或修改 endpoint/backend 时，先确认 `pipeline_run_status` 已完成且 `endpoint list` 能看到预期配置，避免后台复制结果覆盖提前写入的配置
- `endpoint create` / `backend create` 需要完整的 `--janus-group` 和 `--janus-lane` 上下文字段
- `backend create` / `backend update` 必须传 `--url-pattern`，通常与 endpoint path 相同；`--method` 可显式指定，不传时 create 默认 `ANY`
- `endpoint update` / `common-arg query` 需要 `--mid`（Janus Mini group module ID），可通过 `group list --psm` 查询获取；`common-arg query` 推荐同时传 `--janus-group` 和 `--janus-lane` 补齐请求上下文
- `publish create` 只创建 Janus Mini 发布 workflow，并在 JSON 输出中返回 `data.data.workflow.wid`；它不会自动把 workflow 推进到灰度、全量或完成状态
- `publish list` 用上一步返回的 workflow ID 查询发布工单状态；`publish advance` 用 `--status` 推进已有发布工单，常用状态为 `graying`、`canary`、`single`、`all`、`fulling`、`finished`
- `publish list` 返回的 `deploy_status`：0=无需部署, 1=部署中, 2=部署完成；仅当 `status=5` 且 `deploy_status=2` 且 `failed_reason` 为空时发布完成
- BOE/PPE 的 graying 阶段 `deploy_status` 始终为 0（无实际灰度部署），确认 `failed_reason` 为空后可直接推进到 canary
- Agent/脚本场景优先使用 `--json`，从 `data.data.workflow.wid` 读取 workflow ID，再调用 `publish list` 或 `publish advance`
- 缺少必填参数会自动输出帮助信息

## References

- `references/troubleshooting.md` — 常见问题与处理
