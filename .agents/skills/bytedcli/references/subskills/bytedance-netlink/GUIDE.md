---
name: bytedance-netlink
description: "Operate Netlink (DNS/TLB) via bytedcli: search domains, search paths, list domain configs, and fetch topology/servername details across CN/BOE/I18N/I18N-TT. Use when tasks mention Netlink, domain routing, or path configs."
---

# bytedcli Netlink

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

- Netlink 平台：域名检索、路由/Location 配置排查
- 在一个域名内搜索 path/location
- 拉取 servername(TLB) 配置与拓扑（best-effort）
- 通过 URL 或域名+路径定位后端 PSM、代码仓库和 RPC 方法

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要鉴权的命令先登录：`bytedcli auth login`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 发现 Netlink 支持的站点（best-effort）
bytedcli netlink list-sites

# 搜索域名（CN 默认）
bytedcli netlink search-domain --keyword "api.example.com" --page 1 --page-size 10

# 列出一个域名的所有 Location 配置（TLB servername locations）
bytedcli netlink list-domain-configs --domain "api.example.com"

# 搜索一个域名内的 path/location
bytedcli netlink search-path --domain "api.example.com" --keyword "demo-path"

# 查看具体 path 的配置（支持 =/path 或 /path）
bytedcli netlink get-path-config --domain "api.example.com" --path "=/v3/chat/demo-path"
bytedcli netlink get-path-config --domain "api.example.com" --path "/v3/chat/demo-path"

# 获取域名拓扑信息（best-effort）
bytedcli netlink get-topology --domain "api.example.com"

# 按 servername id 获取 TLB 完整配置
bytedcli netlink get-servername --servername-id 12345 --unified-platform-id 67890

# 切换环境（BOE / I18N / I18N-TT）
bytedcli --site boe netlink search-domain --keyword "example.com"
bytedcli --site i18n-bd netlink search-domain --keyword "docs.example.com"
bytedcli --site i18n-tt netlink search-domain --keyword "example.com"

# 需要结构化输出时加 --json
bytedcli --json netlink list-domain-configs --domain "api.example.com"

# 搜索正向代理（forward-proxy）
bytedcli netlink forward-proxy search --account "proxy-abc123"

# 获取正向代理出口白名单 IP（每行一个）
bytedcli netlink forward-proxy get --account "proxy-abc123" --cluster "normal_flow_fixed_l7" --ips-only

# 通过 URL 定位 PSM、代码仓库和 RPC 方法（一步到位）
bytedcli netlink locate --url "api.example.com/v1/demo-path"
bytedcli netlink locate --domain "api.example.com" --path "/v1/demo-path"

# JSON 输出
bytedcli --json netlink locate --url "api.example.com/v1/demo-path"
```

## Notes

- 使用全局 `--site` 选择站点（`cn|boe|i18n-bd|i18n-tt`，默认 `cn`）。Per-service `--netlink-site` is a hidden alias for backward compatibility.
- `--unified-platform-id` 用于按特定业务平台过滤结果；`list-domain-configs`、`search-path`、`get-path-config`、`get-topology` 会自动从域名的 `business.node_id` 解析，通常无需手动指定；`get-servername` 因无域名上下文，仍需显式传入
- `locate` 命令支持 `--url`（自动拆分域名和路径）或 `--domain` + `--path` 两种方式；它会依次查询 TLB 路由（Netlink）→ IDL 和仓库信息（Overpass）→ 解析 Thrift IDL 中的 RPC 方法；如果 Overpass 不可用，仍会返回 TLB 路由信息；域名查找支持通配域名兜底匹配，例如 FaaS `*.fn.bytedance.net`；对于可访问的 HTTPS 目标，还会补发 `HEAD` probe 尝试提取 `x-gw-dst-psm`、request id、trace id 等运行时 headers。对于 FaaS gateway 域名，若 probe 命中了 `x-gw-dst-psm`，CLI 会优先使用这个运行时目标 PSM 继续查询 repo / IDL

## References

- `references/netlink.md`
