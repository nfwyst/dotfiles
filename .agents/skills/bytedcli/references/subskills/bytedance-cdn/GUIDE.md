---
name: bytedance-cdn
description: "Operate ByteCloud CDN via bytedcli: list CDN domains and get domain detail configuration (origin, HTTPS, cache, compression); upload files (with optional archive extraction), delete, refresh and list files on the CDN upload service. Use when tasks mention CDN domain lookup, CDN configuration, CDN CNAME, CDN certificate, CDN origin, fusion-cdn, CDN file upload, CDN upload, or uploading static assets to CDN."
---

# bytedcli CDN

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

- 查询 CDN 域名列表（按域名关键词搜索）
- 查看 CDN 域名的详细配置（源站、HTTPS、缓存、压缩等）
- 确认域名是否被 CDN 系统托管（对比 CNAME 与实际 DNS 解析）
- 检查证书到期时间
- 上传文件到 CDN（单文件、压缩包解压上传）
- 删除、刷新 CDN 文件，列出 CDN 目录内容

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- `cdn domain` 命令（fusion-cdn 控制台）：
  - CN 站点需要 ByteDance SSO 登录：`bytedcli auth login`
  - i18n-tt 站点需要 TikTok SSO 登录：`bytedcli --site i18n-tt auth login`
- `cdn file` 命令（CDN 上传服务）：
  - 弱鉴权，身份由 `--email` 承载；不传时回退到本地登录用户名拼 `@bytedance.com`
  - 需在办公网/VPN 环境下执行（`ife.bytedance.net` 等 host 仅办公网可达）
  - 加密团队空间额外需要 `--cdn-token`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 查询域名列表（CN 站点，默认）
bytedcli cdn domain list --domain example.com

# 查询域名列表（i18n-tt 站点）
bytedcli --site i18n-tt cdn domain list --domain example.com

# 通过域名查看详细配置
bytedcli cdn domain get --domain example.com

# 通过 ID 查看详细配置
bytedcli cdn domain get --id cdn-112997

# JSON 输出
bytedcli --json cdn domain list --domain example.com
bytedcli --json --site i18n-tt cdn domain get --domain example.com

# 上传文件到 CDN（个人空间根目录）
bytedcli cdn file upload --file ./demo-icon.png

# 上传到团队空间指定目录
bytedcli cdn file upload --file ./demo-icon.png --team-space demo-team --dir assets

# 列出 CDN 目录内容
bytedcli cdn file list --dir assets
```

## Commands

### cdn domain list

列出 CDN 域名。

```bash
bytedcli cdn domain list [--domain <keyword>] [--page <n>] [--page-size <n>]
```

| 参数 | 说明 |
|------|------|
| `--domain` | 按域名关键词过滤（模糊匹配） |
| `--page` | 页码，默认 1 |
| `--page-size` | 每页条数，默认 10 |

### cdn domain get

查看 CDN 域名详细配置。支持 `--id` 或 `--domain` 二选一。

```bash
bytedcli cdn domain get --id <domain-id>
bytedcli cdn domain get --domain <domain-name>
```

| 参数 | 说明 |
|------|------|
| `--id` | CDN 域名 ID（如 cdn-112997） |
| `--domain` | 域名（精确匹配，先 list 再取 detail） |

输出包含：基本信息、源站配置、HTTPS/TLS 配置、缓存策略、压缩策略、IPv6/QUIC/WebSocket 状态。

### cdn file

CDN 文件操作，走 CDN 上传服务（与 `cdn domain` 的 fusion-cdn 控制台是不同 host、不同鉴权）。

所有 `cdn file` 子命令共用以下参数：

| 参数 | 说明 |
|------|------|
| `--dir` | 目标目录；个人空间直接填目录名，留空表示空间根目录 |
| `--team-space` | 团队空间名；传入时 `--dir` 解析为团队空间下的目录 |
| `--region` | 上传区域 `INTERNAL\|CN\|SG\|VA2`，默认 `CN` |
| `--email` | 用户邮箱，默认取本地登录用户 |
| `--cdn-token` | 加密团队空间的 `x-cdn-token` |

```bash
# 上传单个文件
bytedcli cdn file upload --file <path> [--dir <dir>] [--team-space <name>] [--auto-refresh]

# 上传压缩包并解压（加 --unzip；--file 与 --url 二选一）
bytedcli cdn file upload --unzip --file <archive> [--dir <dir>]
bytedcli cdn file upload --unzip --url <archive-url> [--dir <dir>]

# 删除文件
bytedcli cdn file delete --file <name> [--dir <dir>] [--auto-refresh]

# 刷新文件
bytedcli cdn file refresh --file <name> [--dir <dir>]

# 列出目录内容
bytedcli cdn file list [--dir <dir>] [--team-space <name>]
```

`upload` 默认上传单个文件，成功后返回 `cdnUrl`（完整 CDN 加速地址），JSON 模式下还包含 `domain` / `path` / `tosKey`；加 `--unzip` 时把上传内容当压缩包解压，返回解压后的文件 URL 列表。

## Agent Guidance

### 站点选择

- CN 域名（`*.bytedance.net`、`*.coze.cn` 等）使用默认 `--site cn`
- 海外域名（`*.coze.com`、`*.byteintl.net` 等）使用 `--site i18n-tt`
- i18n-tt 站点需要单独的 TikTok SSO 登录态

### 判断域名是否被 CDN 托管

1. 通过 `cdn domain get --domain <name>` 获取 CDN 系统中的 CNAME
2. 通过 `dig +short <name> CNAME` 获取实际 DNS 解析
3. 若两者一致，说明域名已被 CDN 系统托管，证书可自动续期
4. 若 CDN 中找不到该域名，则未托管

### CDN 文件上传

- `cdn file` 的 `--region` 决定请求 host：`INTERNAL`/`CN` 走 `ife.bytedance.net`，`SG`/`VA2` 走 `ife-cdn.byteintl.net`；与 `cdn domain` 的 `--site` 互不影响。
- 上传服务为弱鉴权：身份由 `--email` 承载，需保证该邮箱对目标空间有权限；命令默认用本地登录用户名，跨账号操作时显式传 `--email`。
- 团队空间不要手写固定前缀，统一用 `--team-space <name>` + `--dir <subdir>`，CLI 会自动拼接。
- 报错提示“团队空间已被加密”时，补 `--cdn-token <token>` 重试。
- `upload --unzip` 的压缩包应为扁平结构（文件直接在包根目录）；若包内含顶层目录，服务端只解压根层文件，目录内条目不会落地，返回的 URL 列表也会相应为空。
- 上传服务仅面向 QPS ≤ 10 的内部低频场景；对外业务或高 QPS 上传应改用 TOS。

### 常见错误

- `Not authenticated`：需要登录对应站点，提示中包含完整登录命令
- `Domain "xxx" not found`：该域名在指定站点的 CDN 系统中不存在，尝试切换站点
- `cdn file` 请求超时/不可达：确认当前在办公网或 VPN 环境
