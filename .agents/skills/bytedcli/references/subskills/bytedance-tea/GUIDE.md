---
name: bytedance-tea
description: "Operate TEA (DataOpen / tea-next) via bytedcli: search dashboard info and dashboard reports, fetch report DSL from tea-next URLs, query analysis data by DSL, query behavior-detail event flows, generate analysis result links from DSL, and query event metadata. Supports multi-region (cn/va/sg/sglark). Use when tasks mention TEA, tea-next dashboards, reports, snapshots, DSL, DataOpen access_token, behavior detail, event flows, event metadata, or generating analysis links."
---

# bytedcli TEA

## 如何调用 bytedcli

先选择一种调用方式。下面所有示例默认直接写 `bytedcli`。

```bash
# 方式 1：直接用 npx 运行最新版
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]

# 方式 2：先全局安装，再直接调用 bytedcli
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli <command> [options]
```

- 使用 `npx` 时，把后文示例里的 `bytedcli` 替换成 `NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest`
- 已全局安装时，直接按后文示例执行 `bytedcli ...`

## When to use

- 需要从 tea-next 看板 / 报表链接提取 DSL
- 需要用 DSL 调用 TEA DataOpen 接口查询报表数据
- 需要从 tea-next 行为细查详情页查询用户行为流（behavior-detail/detail）
- 需要根据 DSL 生成 tea-next 分析结果链接
- 需要查看有权限的看板信息 / 看板内报表列表
- 查询多个区域的 tea 数据，支持 cn、va、sg、sglark 地区
- 需要查询事件元数据（event metadata）

## Auth 模式

tea 子命令支持两种鉴权模式，通过 `--auth-mode` 选择，默认 `auto` 自动判定：

| 模式 | 适用 | 凭据来源 |
|---|---|---|
| `dataopen` | DataOpen openapi（cn / va / sg） | 环境变量 `TEA_APP_ID` + `TEA_APP_SECRET`，或 `--app-id` / `--app-secret` 参数 |
| `titan` | tea-next 内部 API（cn / va / sg / sglark 全部支持） | `bytedcli auth login` 后自动换 `titan_passport_id` cookie |

判定优先级（`decideAuthMode`）：

1. 显式 `--auth-mode dataopen|titan` 最高优先
2. site 为 `sglark` → 强制 `titan`（sglark 不支持 DataOpen）
3. 当 `TEA_APP_ID`+`TEA_APP_SECRET` 均存在 → `dataopen`
4. 其他情况 → `titan`（cn / va / sg 在没有 DataOpen 凭据时会自动走 titan，无需申请 App，仅需扫码登录一次）

### Prerequisites (DataOpen 模式)

```env
TEA_APP_ID=123456
TEA_APP_SECRET=***
```

申请地址：https://data.bytedance.net/dataopen/tea-next/app

### Prerequisites (titan 模式)

```bash
bytedcli auth login  # 扫码登录即可，无需申请 DataOpen App
```

### Region / Control plane

所有 tea 子命令支持 `--region` 或 `--tea-site` 切换控制面：

| 区域 | 值 | DataOpen 域名 | Titan internal 域名 | DataOpen | Titan |
|---|---|---|---|---|---|
| 中国（默认） | `cn` | `data.bytedance.net/dataopen/open-apis` | `data.bytedance.net/datafinder/api/v1` | ✅ | ✅ |
| Virginia | `va` | `data-va.tiktok-row.net/dataopen/open-apis` | `tea-va.bytedance.net` 或 `tea-va.tiktok-row.net` `/datafinder/api/v1` | ✅ | ✅ |
| Singapore | `sg` | `dataopen-sg.tiktok-row.net/dataopen/open-apis` | `tea-sg.tiktok-row.net/datafinder/api/v1` | ✅ | ✅ |
| SG Lark | `sglark` | — | `tea-sglark.bytedance.net/datafinder/api/v1` | ❌ | ✅ |

> cn / va / sg 三个区域 DataOpen 与 Titan 任选其一；如果没有 DataOpen App 凭据，可直接 `bytedcli auth login` 后用 `--auth-mode titan`（或留空 `--auth-mode` 让默认逻辑兜底）。SG Lark 仅支持 titan。
>
> VA 区域同时识别 `tea-va.bytedance.net` 与 `tea-va.tiktok-row.net` 两个 host，用户给的 URL host 会优先于 site 默认值，避免请求被改写到错误后端。

- `--tea-site cn|va|sg|sglark|auto`：显式选择控制面；`auto` 会按 tea-next URL host 自动推断（识别 `data.bytedance.net` / `tea.bytedance.net` / `tea-va.bytedance.net` / `tea-va.tiktok-row.net` / `dataopen-sg.tiktok-row.net` / `tea-sg.bytedance.net` / `tea-sg.tiktok-row.net` / `tea-sglark.bytedance.net`）
- `--tea-base-url <url>`：直接覆盖 DataOpen API 基址（仅 DataOpen 模式有效）

优先级：`--tea-base-url` > `--tea-site` > `--region`

## Quick start

```bash
# 看板信息
bytedcli tea search --type dashboard_info --url https://data.example.net/tea-next/project/3/dashboard/7446993126637437450

# 看板内报表列表
bytedcli tea search --type dashboard_reports --url https://data.example.net/tea-next/project/3/dashboard/7446993126637437450

# 从报表 URL 获取 DSL（report 类型）
bytedcli tea get-dsl --url https://data.example.net/tea-next/project/3/event-analysis/7447021494577660443?dashboardId=7446993126637437450

# 从快照 URL 获取 DSL（snapshot 类型）
bytedcli tea get-dsl --url https://data.example.net/tea-next/project/3/event-analysis/result/zaa4ac0427bb59b3fbc4589

# 获取 DSL 后直接查询（建议加 --json 便于机器读取）
bytedcli --json tea get-dsl --url https://data.example.net/tea-next/project/3/event-analysis/7447021494577660443 | \
  bytedcli --json tea query

# 根据 DSL 生成 tea-next 分析结果链接（DSL 通过管道传入，query-type 从 DSL 自动推断）
bytedcli tea get-dsl --url https://data.example.net/tea-next/project/3/event-analysis/7447021494577660443 | \
  bytedcli tea dsl2link

# 根据 DSL 生成链接（直接传入 DSL，query-type 从 DSL content.query_type 自动推断）
# 自动映射：event→event-analysis, retention→retention-analysis, funnel→funnel-analysis, path_find→pathfind-analysis, life_cycle→life_cycle-analysis, event_topk→distribution-analysis, composition→compositon-analysis
bytedcli tea dsl2link --dsl '{"resources":[{"project_ids":[55]}],"content":{"query_type":"event"}}'

# 也可以显式指定 --query-type 覆盖自动推断
bytedcli tea dsl2link --query-type event-analysis --dsl '{"resources":[{"project_ids":[55]}],"content":{}}'

# 查询事件元数据
bytedcli tea get-event --project-id 123 --events app_launch,page_view

# 查询行为细查行为流（URL 自动解析 project/query/app/time/eventFilterList）
bytedcli tea behavior --url 'https://data.bytedance.net/tea-next/project/<project_id>/behavior-detail/detail?query_id=<id>&query_type=device_id&appId=<app_id>&timestamp=<start_ms>&timestamp=<end_ms>&eventFilterList=%5B%5D&sort=desc' --dump ./behavior.json

# 行为细查：用精确事件名做服务端前置过滤，避免拉取大量无关埋点
bytedcli tea behavior --project-id 123 --behavior-app-id 456 --query-id '<device_id>' --query-type device_id --start-time 1776096000 --end-time 1776182399 --events app_launch,page_view --dump ./behavior.json

# 查询事件元数据（VA 区域）
bytedcli tea get-event --project-id 123 --events app_launch --region va

# 按 tea-next URL host 自动推断控制面
bytedcli tea get-dsl --tea-site auto --url https://tea-va.example.net/tea-next/project/302625/funnel-analysis/result/sample-snapshot-id

# 显式指定 VA 控制面
bytedcli tea get-dsl --tea-site va --url https://tea-va.example.net/tea-next/project/302625/funnel-analysis/result/sample-snapshot-id

# 直接覆盖 DataOpen 基址
bytedcli tea query --tea-base-url https://data-va.example.net/dataopen/open-apis --dsl '{"use_app_cloud_id":true,"version":3,"content":{}}'

# 查询事件元数据（JSON 输出数据量大，需搭配 --dump）
bytedcli tea get-event --project-id 123 --events app_launch,page_view --json --dump ./events.json

# 查询事件元数据并将原始 JSON 写入文件
bytedcli tea get-event --project-id 123 --events app_launch --with params,virtual_params --dump ./events.json

# VA 区域查询
bytedcli tea search --type dashboard_info --url https://data-va.example.net/tea-next/project/3/dashboard/7446993126637437450 --region va
bytedcli --json tea get-dsl --url https://data-va.example.net/tea-next/project/3/event-analysis/7447021494577660443 --region va | \
  bytedcli --json tea query --region va

# SG Lark 租户（titan 模式，扫码即用）
# 先扫码登录一次
bytedcli auth login

# 看板信息（sglark 自动走 titan 模式）
bytedcli tea search --type dashboard_info \
  --url https://tea-sglark.bytedance.net/tea-next/project/<pid>/dashboard/<did>

# 看板报表列表（sglark titan 模式下可直接从响应抽取 DSL）
bytedcli tea search --type dashboard_reports \
  --url https://tea-sglark.bytedance.net/tea-next/project/<pid>/dashboard/<did>

# 拿某个 report 的 DSL（sglark titan 模式下 --dashboard-id 必填；URL 中含 /dashboard/<id> 会自动识别）
bytedcli tea get-dsl \
  --url https://tea-sglark.bytedance.net/tea-next/project/<pid>/event-analysis/<rid>?dashboardId=<did>

# 执行报表分析（sglark titan 模式走三元组 project/dashboard/report）
bytedcli tea query \
  --url https://tea-sglark.bytedance.net/tea-next/project/<pid>/dashboard/<did>/reports/<rid>

# cn / va / sg titan 模式（无需申请 DataOpen App，扫码即用）
bytedcli auth login

# cn 区域 titan 看板信息
bytedcli tea search --type dashboard_info --tea-site cn --auth-mode titan \
  --url https://data.bytedance.net/tea-next/project/<pid>/dashboard/<did>

# va 区域 titan 从 snapshot 链接拿 DSL（走 /analysis/<id>/result?pack_dsl=1，不需要 dashboardId）
bytedcli tea get-dsl --tea-site va --auth-mode titan \
  --url https://tea-va.tiktok-row.net/tea-next/project/<pid>/event-analysis/result/<snapshot-id>

# cn 区域 titan 执行查询（与 DataOpen 一样直接 pipe DSL，不需要三元组；CLI 自动轮询异步结果）
bytedcli --json tea get-dsl --tea-site cn --auth-mode titan \
  --url https://data.bytedance.net/tea-next/project/<pid>/event-analysis/result/<snapshot-id> \
  | bytedcli --json tea query --tea-site cn --auth-mode titan
```

## 动态事件分析
如果用户期望根据指定事件进行多个维度下钻的复杂分析，参考 `references/usages/usages.md`的流程进行。

## Notes

- `tea search` 会从 URL 自动解析 `project_id` 与 `dashboard_id`。
- `tea get-dsl` 支持从 stdin 读取 URL；`tea query`（DataOpen 模式）支持从 stdin 读取 DSL JSON。
- `tea behavior` 查询行为细查行为流，支持从 `/behavior-detail/detail` URL 自动解析 `project_id/query_id/query_type/appId/timestamp/eventFilterList/sort`。`--behavior-app-id` 是行为细查请求体 `app_id`；`--app-id` 是 DataOpen 凭证 app id。`--events` 会下发为 OpenAPI `event_name`，用于精确事件名服务端前置过滤。**注意：`--json` 模式下必须搭配 `--dump` 使用**，原始行为流会写入文件。
- `tea get-event` 查询事件元数据，`--events` 为必填参数（逗号分隔事件名）。`--dump <filepath>` 可将原始 JSON 结果写入文件（相对路径基于工作目录）。**注意：`--json` 模式下必须搭配 `--dump` 使用**，原始数据量较大不适合直接输出到终端。
- `--region`：切换 DataOpen 区域（`cn` | `va` | `sg`，默认 `cn`）。使用管道联动时，每个子命令都需要指定 `--region`。
- `--tea-site`：切换控制面（`cn` | `va` | `sg` | `sglark` | `auto`）；需要按 tea-next URL host 路由海外控制面时优先推荐使用。
- `--tea-base-url`：直接覆盖 DataOpen API 基址，适合调试特殊网关或临时验证。
- `--auth-mode`：`dataopen` / `titan` / `auto`（默认），titan 模式下无需 TEA_APP_ID/SECRET，先 `bytedcli auth login` 扫码登录即可。
- `--project-id`：不传时优先从 URL 自动解析，兜底使用 3。

### Titan 模式说明

Titan 走的是 tea-next 的内部 API（`/datafinder/api/v1/*`），只暴露了一部分 endpoint。下面按命令列出实际能力：

| 命令 | dataopen | cn / va / sg titan | sglark titan |
|---|---|---|---|
| `tea search` | ✅ | ✅ | ✅ |
| `tea get-dsl` | ✅ POST `/projects/<pid>/dsls` | ✅ GET `/analysis/<id>/result?pack_dsl=1`（snapshot/report 都不需要 dashboardId） | ✅ GET `/dashboards/<did>/reports` 兜底（需要 dashboardId；snapshot URL 不支持） |
| `tea query` | ✅ POST `/analysis`（同步） | ✅ POST `/analysis`（异步：返回 `result_id` 后 CLI 自动轮询 `/analysis/<result_id>/result`） | ✅ POST `/reports/<rid>/analysis`（需要 project/dashboard/report 三元组，只能走 URL 或显式三个 ID） |
| `tea behavior` | ✅ | ❌（内部 API 未暴露 `behaviors/flows_v3`） | ❌ |
| `tea get-event` | ✅ | ❌（内部 API 未暴露 `metadata/list/events`） | ❌ |
| `tea get-profile` | ✅ | ❌（内部 API 未暴露 `metadata/list/user_profiles`） | ❌ |
| `tea dsl2link` | ✅ | ❌（内部 API 未暴露 `dsls/jumper`） | ❌ |

要点：

- `sglark` 站点只支持 titan 模式；显式传 `--auth-mode dataopen --tea-site sglark` 会报错。
- `tea query` 在 cn / va / sg titan 下与 DataOpen 一样直接传 DSL（通过 `--dsl` 或 stdin），不需要三元组。`/analysis` 是异步 endpoint，CLI 默认轮询超时 60s；超时会输出 `result_id` 与最近状态，可用同一条命令重试。
- `tea get-dsl` 在 cn / va / sg titan 下走 `GET /analysis/<id>/result?pack_dsl=1`，对 snapshot 与 report URL 都适用，**不需要** `--dashboard-id`。
- `tea get-dsl` 在 sglark titan 下没有 `/analysis/<id>/result` 兜底，必须有 `--dashboard-id`（URL 中含 `dashboardId=` 或 `/dashboard/<id>` 时会自动解析）；snapshot URL 在 sglark 上不支持。
- `tea behavior` / `tea get-event` / `tea get-profile` / `tea dsl2link` 在所有区域 titan 模式下都不支持（tea-next 内部 API 没有对应路径），会报 `TEA_TITAN_NOT_SUPPORTED`；想用这些命令必须切到 DataOpen 模式（cn/va/sg）。
