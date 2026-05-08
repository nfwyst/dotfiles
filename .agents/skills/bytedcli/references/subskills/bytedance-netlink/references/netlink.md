# Netlink

Netlink 相关能力用于排查域名接入、TLB servername 与 Location(path) 配置。

## 环境与站点

Use global `--site` to select the ByteCloud deployment. Per-service `--netlink-site` is a hidden alias for backward compatibility.

- CN: `--site cn`（默认）
- BOE: `--site boe`
- I18N(BD): `--site i18n-bd`
- I18N-TT: `--site i18n-tt`

站点差异（bytedcli 内部已处理）：

- CN/BOE：API host 在 ByteCloud 控制台域名下（`cloud.bytedance.net` / `cloud-boe.bytedance.net`），请求需要 `x-bcgw-tenant-id: bytedance`
- I18N：API host 为 `netlink-i18nbd.byteintl.net`，JWT 从 `cloud.byteintl.net` 获取
- I18N-TT：API host 为 `cloud.tiktok-row.net`，JWT 从 `cloud-i18n.bytedance.net` 获取
- forward-proxy：部分接口使用 Netlink 独立网关（如 CN 搜索走 `netlink.bytedance.net`），而详情仍在 ByteCloud 控制台网关下

## 命令映射

- `netlink search-domain`：通过 domain list 搜索域名，返回 `servername_id/namespace_id` 等信息
- `netlink list-domain-configs`：拉取 servername 详情并列出所有 Location
- `netlink search-path`：在 servername locations 中按关键字搜索
- `netlink get-path-config`：获取单个 Location（支持 `=/path` 或 `/path`）
- `netlink get-topology`：按域名获取拓扑信息（best-effort）
- `netlink get-servername`：按 servername id 获取完整配置（best-effort）
- `netlink forward-proxy search`：按 account 搜索正向代理列表
- `netlink forward-proxy get`：获取正向代理详情（包含出口白名单 IP）；`--ips-only` 可仅输出白名单 IP 列表（每行一个）
- `netlink locate`：通过 URL 或域名+路径一步定位后端 PSM、代码仓库（Overpass）和匹配的 RPC 方法（Thrift IDL 解析）；支持 `--url` 或 `--domain` + `--path`，并支持通配域名兜底匹配（例如 FaaS `*.fn.bytedance.net`）；对于可访问的 HTTPS 目标，还会补发 `HEAD` probe 尝试提取 `x-gw-dst-psm` 等运行时 headers。对于 FaaS gateway 域名，若 probe 命中了 `x-gw-dst-psm`，CLI 会优先使用这个运行时目标 PSM 继续查询 repo / IDL

## 参数

- `--unified-platform-id`：按特定业务平台过滤结果；需要收窄结果范围时显式指定
