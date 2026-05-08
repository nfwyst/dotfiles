---
name: bytedance-tiktok-gecko
description: "Use bytedcli tiktok-gecko commands to query TikTok Gecko read-only resources, including workbench, app/channel/ticket/host-app/deployment, and deployment-channel relationships. Trigger this skill whenever the user asks to inspect Gecko console data, list or get Gecko resources, filter Gecko tickets, or troubleshoot Gecko IDs/regions with CLI."
---

# bytedcli TikTok Gecko

## 如何调用 bytedcli

此 skill 只支持 TikTok ROW 运行时，调用前缀固定为：

```bash
bytedcli --site i18n-tt --auth-site tiktok <command> [options]
```

- 不支持其他 `--site`（如 `cn`、`i18n-bd`、`eu-ttp`、`boe`）。
- 不支持其他 `--auth-site`（如 `bytedance`、`test`）。
- 使用 `npx` 时，把后文示例里的 `bytedcli` 替换成 `NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest`
- 已全局安装时，直接按后文示例执行 `bytedcli ...`

## When to use

- 查询 TikTok Gecko 工作台关注项和待处理工单
- 按名称或条件分页查询 Gecko App / Channel / Ticket / Host App
- 根据 ID 拉取单个 Gecko 资源详情（App、Channel、Ticket、Host App、Deployment）
- 查看 Deployment 下关联的 Channel 列表
- 需要基于 CLI 快速确认 Gecko 资源 ID、地域、状态或关联关系

## 前置条件

- 建议先确认 TikTok 站点登录态可用：

```bash
bytedcli --site i18n-tt --auth-site tiktok auth status
```

- 若未登录或 token 失效，先执行：

```bash
bytedcli --site i18n-tt --auth-site tiktok auth login
```

## Quick start

```bash
# 工作台概览（关注 Channel/App/Deployment + 待处理工单）
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko workbench get

# 列表查询
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko app list --page 1 --page-size 20
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko channel list --region row --name demo-channel
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko ticket list --creator demo.user --status pending
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko host-app list --keyword demo-app

# 详情查询（按 ID）
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko app get --app-id 170
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko channel get --channel-id 942177
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko ticket get --ticket-id 8021571
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko host-app get --host-app-id 3006
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko deployment get --deployment-id 352

# 查询部署下的 Channel
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko deployment channel list --deployment-id 352 --type all

# 查询某个 Channel 下的资源包（推荐）
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko channel package list --channel-id-list 931972,931973 --creator-list demo.user

# 资源包高级过滤（与控制台 package-meta/list 参数对齐）
bytedcli --site i18n-tt --auth-site tiktok tiktok-gecko channel package list \
  --channel-id-list 931972,931973 \
  --region-list row,eu-ttp,us-ttp \
  --target-os-list 0,1,2,3,4,5,6 \
  --meta-package-id-list 16610282 \
  --region-package-id-list 375801848 \
  --package-type-list 1,2 \
  --env-lane-list ppe \
  --creator-list demo.user \
  --page 1 --page-size 20
```

## 常用操作指南

1. **先拿列表再查详情**：先用 `list` 命令确认资源 ID，再用 `get` 命令拉详细信息，避免手填错误 ID。
   - `channel get --channel-id` 需要传 **channel meta id**（例如 `channel list` 返回里的 `metaIdList`），不是 deployment 下的 channel region id。
2. **先按条件缩小范围**：`channel list` 可用 `--region` / `--name`；`ticket list` 可用 `--creator` / `--reviewer` / `--status` / `--type`。
   - 查询某个 channel 的资源包时，优先使用 `channel package list`（底层接口为 `channel/package-meta/list`）。
3. **排查部署关联关系**：先 `deployment get` 看部署基本信息，再用 `deployment channel list` 看挂载 Channel。
4. **结构化输出给自动化流程**：在全局参数添加 `--json`，例如 `bytedcli --json --site i18n-tt tiktok-gecko app list`。

## Notes

- `tiktok-gecko` 当前为只读查询能力，不包含创建、更新、发布等写操作。
- `tiktok-gecko` 只支持 TikTok ROW 的 ByteCloud 站点 `--site i18n-tt`（或 `BYTEDCLI_CLOUD_SITE=i18n-tt`）。在该站点下 TikTok SSO 为默认推导，通常可省略 `--auth-site tiktok`；若显式传入其他 `--auth-site`，命令会在入口处报错。
- `tiktok-gecko ticket list` 的时间筛选参数使用 epoch 毫秒：`--create-start-time` / `--create-end-time`。
- `deployment channel list` 默认 `--type all`，与控制台部署详情页默认筛选一致。
- 资源包环境可通过 `deploymentName` 快速判断：`online_deployment` 通常为线上包，`in_house_deployment` 通常为测试包。
