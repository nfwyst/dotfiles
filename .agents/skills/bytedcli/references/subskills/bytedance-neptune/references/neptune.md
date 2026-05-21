# Neptune

Neptune 用于服务治理配置查询（安全/稳定性/限流/调度），并支持生成 ACL 申请页跳转 URL。

## 环境与站点

Use global `--site` to select the ByteCloud deployment. Per-service `--neptune-site` is a hidden alias for backward compatibility.

- CN: `--site cn`（默认）
- BOE: `--site boe`
- ByteIntl: `--site byteintl`
- TikTok ROW: `--site i18n-tt`（aliases: `i18ntt|row|tiktok|tiktok-row`；`sg` 保持兼容 ByteIntl）

站点差异（bytedcli 内部已处理）：

- CN/BOE：API host 在 ByteCloud 控制台域名下（`cloud.bytedance.net` / `cloud-boe.bytedance.net`），请求需要 `x-bcgw-tenant-id: bytedance`
- ByteIntl：API host 为 `cloud.byteintl.net`，请求不需要 `x-bcgw-tenant-id`
- TikTok ROW：API host 为 `cloud.tiktok-row.net`，请求不需要 `x-bcgw-tenant-id`

## 站点/VRegion 自动发现（best-effort）

命令：`neptune list-sites`

bytedcli 会调用平台 meta 接口 `list_platform_vregions?platform=neptune`（并缓存 1 天）来尽量列出支持的站点与 VRegion。

## zones/vregions 列表（best-effort）

命令：`bytedcli --site <site> neptune list-cp-regions`

用于查询 Neptune 当前站点支持的 `zones` 与 `vregions` 列表，便于为后续配置查询选择正确的 `--zone`。

## 命令映射

- `neptune security`：安全配置（支持 `--method`，默认 `*`；支持 `--direction ingress|egress`）
- `neptune stability`：稳定性配置（支持 `--direction ingress|egress`）
- `neptune rate-limit`：限流配置（支持 `--direction ingress|egress`；`--v2` 仅对 ingress 生效）
- `neptune dispatch`：调度配置（支持 `--direction ingress|egress`）
- `neptune acl-status`：zone 级 ACL 总开关查询（`acl/get_status`），返回 `mode: offline|online`
- `neptune strict-auth-status`：服务级严格授权状态（`acl/strict_authorization/status`），返回 `mode: deleted|open`
- `neptune acl-check`：综合 ACL 三层（acl-status + strict-auth-status + security/ingress），按 caller/callee/zone 输出 `verdict: allow|allow-explicit|deny-strict|deny-explicit|indeterminate`。判断"能不能调通"优先用这个，单跑 `neptune security` 容易误判（exist=false 在 ACL 未启用的 zone 不等于"被拒"）
- `neptune acl apply`：直接提交 Neptune ACL 申请；支持批量 `--callee` / `--callees-file`，以及多 region 输入 `--region` / `--vregion`（逗号分隔或多次传参）。CLI 会按控制面自动分组并提交：`US-TTP/US-TTP2 -> us-ttp`（页面域名 `https://cloud-ttp-us.bytedance.net`，提交网关 `https://cloud.tiktok-us.net`）、`EU-TTP/EU-TTP2/USEASTRED -> eu-ttp`（页面域名 `https://cloud-eu.tiktok-row.net`，提交网关 `https://bc-iedt-gw.tiktok-eu.net`）、`SGALI -> sg`（页面域名 `https://cloud.tiktok-row.net`，提交网关 `https://cloud-i18n.bytedance.net`）。同一控制面的多个 region 会合并为一次提交，跨控制面会拆分成多次提交。仅支持国际化控制面，CN 不支持；`--reason` 必填；`--zone` 仅保留兼容并会打印 deprecation warning。

## ACL 申请（Agent 简化模式）

在 CLI 能力之上，`bytedance-neptune` skill 为 `neptune acl apply` 提供了一层“简化模式”，帮助从自然语言意图生成规范的 CLI 参数：

### 1. Region 简写展开

- 用户在描述中使用 `sg`/`sg-ttp`、`us`/`us-ttp`、`eu`/`eu-ttp` 这类控制面或大区简写时，Skill 会自动映射为 CLI 支持的标准 region 列表：
  - `sg` 或 `sg-ttp` → `SGALI`（控制面 `sg`）
  - `us` 或 `us-ttp` → `US-TTP,US-TTP2`（控制面 `us-ttp`）
  - `eu` 或 `eu-ttp` → `EU-TTP,EU-TTP2,USEASTRED`（控制面 `eu-ttp`）
- 展开后的结果始终通过 `--region` 传给 CLI（逗号分隔或多次传参均可），CLI 继续负责按控制面合并/拆分申请单。

### 2. Callee 格式放宽

- 推荐显式使用完整 callee 形式 `psm:cluster:method`。
- 输入 `psm:method` 时，Skill 自动补全为 `psm:default:method`。
- 仅输入 `psm` 时，Skill 自动补全为 `psm:default:*`，并在执行前向用户确认“将对所有方法开放 ACL，是否继续？”，只有用户确认后才会执行。

### 3. Reason 自动生成

- 当用户只描述申请用途而未给出完整 `--reason` 文本时，Skill 会自动构造规范 reason：
  - 单个 callee：`【ACL 申请】<caller-psm>/<caller-cluster> 访问 <callee-psm>/<callee-cluster>:<method>，用途：<用户描述>，region：<展开后的 region 列表>`
  - 多个 callee：每个 callee 独立一行，沿用同一模板。
- 真实执行前，Skill 会回显最终的 caller、callee、region 与 reason 列表，让用户确认无误。

以上逻辑仅发生在 Skill 层；CLI 本身的参数、region 到控制面映射与错误处理仍以本小节前的说明为准。
