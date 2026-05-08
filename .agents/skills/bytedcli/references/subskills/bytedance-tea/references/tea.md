# TEA（DataOpen / tea-next）

## Auth modes

| 模式 | 适用站点 | 凭据来源 | 何时使用 |
|------|---------|---------|---------|
| `dataopen` | cn / va / sg | `TEA_APP_ID` + `TEA_APP_SECRET`（申请 DataOpen App） | 已有 DataOpen App，或需稳定后端对接 |
| `titan`    | cn / va / sg / sglark | `bytedcli auth login` 扫码（走 titan_passport） | 没有 DataOpen App，或想用扫码身份直接调内部 API；sglark 唯一可用，cn/va/sg 与 DataOpen 任选其一 |

通过 `--auth-mode dataopen|titan|auto` 显式切换；默认 `auto` 按下列优先级判定：

1. 命令行显式 `--auth-mode ...` 优先
2. `--tea-site sglark` 或 URL host 是 `tea-sglark.bytedance.net` → 强制 `titan`
3. 存在 `TEA_APP_ID/TEA_APP_SECRET` → `dataopen`
4. 站点支持 titan（当前 cn / va / sg / sglark 全部支持） → `titan`
5. 否则 `dataopen`（此时若无凭据会抛 `TEA_INPUT_ERROR`）

`sglark` 不支持 `dataopen`；cn / va / sg 两条路径任选其一。

## Command map

- `bytedcli tea search`
  - `--type dashboard_info`：按看板 URL 解析出的 `dashboard_id` 获取看板信息
  - `--type dashboard_reports`：列出看板内报表（包含 report_id / report_type / 简要描述）
  - `--tea-site <site>`：cn | va | sg | sglark | auto
  - `--auth-mode <mode>`：dataopen | titan | auto
  - `--tea-base-url <url>`：直接覆盖 DataOpen 基址（仅 dataopen 模式）
- `bytedcli tea get-dsl`
  - 输入：tea-next 报表链接（report）或快照链接（snapshot）
  - 输出：DSL JSON（文本模式直接打印到 stdout；JSON 模式输出 JSON Lines 的 data=DSL 本体，可直接 pipe 到 `tea query`）
  - `--tea-site <site>`：cn | va | sg | sglark | auto
  - `--auth-mode <mode>`：dataopen | titan | auto
  - `--project-id <projectId>`：TEA project_id（不传时优先从 URL 解析）
  - `--dashboard-id <dashboardId>`：仅 sglark titan 必填（sglark 没有 `/analysis/<id>/result` endpoint，要靠 `dashboards/<did>/reports` 兜底）；DataOpen 与 cn/va/sg titan 都不需要
  - `--tea-base-url <url>`：直接覆盖 DataOpen 基址（仅 dataopen 模式）
  - 实际 endpoint：
    - dataopen：`POST /dataopen/open-apis/datafinder/openapi/v1/projects/<pid>/dsls`，snapshot/report 通用
    - cn / va / sg titan：`GET /datafinder/api/v1/analysis/<id>/result?pack_dsl=1`，snapshot/report 通用，DSL 在 envelope 顶层 `dsl` 字段
    - sglark titan：`GET /datafinder/api/v1/dashboards/<did>/reports` 兜底，仅支持 report 类型 URL（带 `dashboardId`）；snapshot URL 不支持
- `bytedcli tea query`
  - **dataopen / cn-va-sg titan 模式**：输入 DSL JSON（`--dsl` 或 stdin），输出 analysis 数据
  - **sglark titan 模式**：需传 `--url` 或同时传 `--project-id/--dashboard-id/--report-id` 三元组；输出报表 analysis 数据
  - `--tea-site <site>`：cn | va | sg | sglark | auto
  - `--auth-mode <mode>`：dataopen | titan | auto
  - `--tea-base-url <url>`：直接覆盖 DataOpen 基址（仅 dataopen 模式）
  - 实际 endpoint：
    - dataopen：`POST /dataopen/open-apis/datafinder/openapi/v1/projects/<pid>/analysis`，同步返回数组
    - cn / va / sg titan：`POST /datafinder/api/v1/projects/<pid>/analysis` 返回 `{ result_id }`，CLI 自动轮询 `GET /datafinder/api/v1/analysis/<result_id>/result`；默认轮询超时 60s（结果尚未就绪时会输出 `result_id`/`status`，可重新执行同一条命令）
    - sglark titan：`POST /datafinder/api/v1/projects/<pid>/dashboards/<did>/reports/<rid>/analysis`
- `bytedcli tea behavior`
  - 查询行为细查行为流（behavior-detail/detail）。**仅 dataopen 模式可用，所有区域 titan 模式都不支持**（tea-next 内部 API `/datafinder/api/v1/...` 未暴露 `behaviors/flows_v3`），titan 调用会抛 `TEA_TITAN_NOT_SUPPORTED`。
  - API: `/dataopen/open-apis/datafinder/openapi/v1/projects/:project_id/behaviors/flows_v3`
  - `--url <url>`：tea-next `behavior-detail/detail` 链接，会自动解析 `project_id/query_id/query_type/appId/timestamp/eventFilterList/sort`
  - `--project-id <projectId>`：TEA project_id（不用 URL 时必填）
  - `--query-id <queryId>`：查询 ID，如 device_id / user_unique_id / user_id
  - `--query-type <queryType>`：`device_id` | `user_unique_id` | `user_id`
  - `--behavior-app-id <appId>`：行为细查请求体 `app_id`；注意不是 DataOpen 凭证 `--app-id`
  - `--start-time <ts>` / `--end-time <ts>`：秒或毫秒时间戳
  - `--events <events>`：精确事件名列表（逗号分隔），会下发为 OpenAPI `event_name` 做服务端前置过滤
  - `--dump <filepath>`：将原始行为流 JSON 写入文件；`--json` 模式下必须搭配 `--dump`
- `bytedcli tea get-event`
  - 查询事件元数据（event metadata）。**仅 dataopen 模式可用，所有区域 titan 模式都不支持**（tea-next 内部 API 未暴露 `metadata/list/events`），titan 调用会抛 `TEA_TITAN_NOT_SUPPORTED`。
  - API: `/dataopen/open-apis/datafinder/openapi/v1/metadata/projects/:project_id/list/events`
  - `--project-id <projectId>`：TEA project_id
  - `--events <events>`：（必填）事件名列表（逗号分隔，如 `app_launch,page_view`）
  - `--status <status>`：事件状态列表（逗号分隔；可选值 0=审批中 1=已上报 3=停止采集 4=隐藏，默认 0,1,3,4）
  - `--with <with>`：附加返回信息（逗号分隔；可选值 params|virtual_params|property_dict|values|alias|event_groups|event_sample，默认 params）
  - `--dump <filepath>`：将原始 JSON 结果写入文件（相对路径基于工作目录）
- `bytedcli tea get-profile`
  - 查询用户属性元数据（user profile metadata）。**仅 dataopen 模式可用，所有区域 titan 模式都不支持**（tea-next 内部 API 未暴露 `metadata/list/user_profiles`），titan 调用会抛 `TEA_TITAN_NOT_SUPPORTED`。
  - API: `/dataopen/open-apis/datafinder/openapi/v1/metadata/projects/:project_id/list/user_profiles`
  - `--project-id <projectId>`：（必填）TEA project_id
  - `--names <names>`：用户属性名列表（逗号分隔，如 `country,age`；不传则返回全部）
  - `--status <status>`：用户属性状态列表（逗号分隔，如 `0,1`；可单独使用，不依赖 `--names`）
  - `--region <region>`：DataOpen 区域（如 `va`、`sg`），用于自动推导 DataOpen 基址
  - `--dump <filepath>`：将原始 JSON 结果写入文件（相对路径基于工作目录）；`--json` 模式下必须搭配 `--dump`
- `bytedcli tea dsl2link`
  - 根据 DSL 生成 tea-next 分析结果链接。**仅 dataopen 模式可用，所有区域 titan 模式都不支持**（tea-next 内部 API 未暴露 `dsls/jumper`），titan 调用会抛 `TEA_TITAN_NOT_SUPPORTED`。
  - API: `/dataopen/open-apis/datafinder/openapi/v1/projects/:project_id/dsls/jumper`
  - `--query-type <queryType>`：查询类型（不传时从 DSL 的 `content.query_type` 自动推断）；可选值 `event-analysis` | `retention-analysis` | `funnel-analysis` | `compositon-analysis` | `pathfind-analysis` | `life_cycle-analysis` | `distribution-analysis`
  - DSL `content.query_type` 自动映射：`event`→`event-analysis`, `retention`→`retention-analysis`, `funnel`→`funnel-analysis`, `path_find`→`pathfind-analysis`, `life_cycle`→`life_cycle-analysis`, `event_topk`→`distribution-analysis`, `composition`→`compositon-analysis`
  - `--dsl <dslJson>`：DSL JSON（字符串形式；也支持从 stdin 读取）
  - `project_id` 从 DSL 的 `resources[0].project_ids[0]` 自动提取，无需手动指定

所有子命令都支持 `--json`（JSON Lines 输出）与 `--dump <filepath>`。

## Sites

| 区域 | 值 | 前端入口 host（用户浏览器） | DataOpen 基址 | Titan internal host |
|------|------|--------------|--------------|--------------|
| 中国 | `cn` | `data.bytedance.net` / `tea.bytedance.net` | `data.bytedance.net/dataopen/open-apis` | `data.bytedance.net` |
| Virginia | `va` | `tea-va.bytedance.net` 或 `tea-va.tiktok-row.net` | `data-va.tiktok-row.net/dataopen/open-apis` | `tea-va.bytedance.net` 或 `tea-va.tiktok-row.net`（与 URL host 一致） |
| Singapore | `sg` | `tea-sg.tiktok-row.net` | `dataopen-sg.tiktok-row.net/dataopen/open-apis` | `tea-sg.tiktok-row.net`（办公网）；`tea-sg.bytedance.net` 是生产网 host，办公网外不可达 |
| SG Lark | `sglark` | `tea-sglark.bytedance.net` | —（titan only） | `tea-sglark.bytedance.net` |

`--tea-site auto` 会按 URL host 自动推断；`--tea-base-url <url>` 可直接覆盖 DataOpen 基址（海外私有部署场景）。

VA 区域的 titan host 会保留 URL 中的实际 host：用户给的链接是 `tea-va.tiktok-row.net` 时，CLI 会同时把 cookie 签发与后续请求都发到 `tea-va.tiktok-row.net`，避免被改写到 `tea-va.bytedance.net` 后命中错误后端。

## Inputs

### Dashboard URL
`.../tea-next/project/<project_id>/dashboard/<dashboard_id>`

### Report URL
`.../tea-next/project/<project_id>/event-analysis/<report_id>?dashboardId=<dashboard_id>`

### Snapshot URL
`.../tea-next/project/<project_id>/event-analysis/result/<snapshot_id>`

### Behavior detail URL
`.../tea-next/project/<project_id>/behavior-detail/detail?query_id=<id>&query_type=<type>&appId=<app_id>&timestamp=<start_ms>&timestamp=<end_ms>&eventFilterList=%5B%5D`
