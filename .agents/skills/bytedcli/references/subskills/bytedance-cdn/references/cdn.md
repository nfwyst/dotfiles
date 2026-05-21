# bytedcli CDN 命令参考

## cdn domain list

列出 CDN 域名，支持关键词过滤。

```bash
# 默认查 CN 站点
bytedcli cdn domain list --domain api.coze.cn

# 查 i18n-tt 站点
bytedcli --site i18n-tt cdn domain list --domain api.coze.com

# 分页
bytedcli cdn domain list --domain coze --page 1 --page-size 20

# JSON 输出
bytedcli --json cdn domain list --domain api.coze.cn
```

输出字段：ID, Name, Status, CNAME, Owner

## cdn domain get

查看单个域名的完整 CDN 配置。

```bash
# 通过 ID
bytedcli cdn domain get --id cdn-157402

# 通过域名（精确匹配）
bytedcli cdn domain get --domain api.coze.cn

# i18n-tt 站点
bytedcli --site i18n-tt cdn domain get --domain api.coze.com

# JSON 输出（适合程序消费）
bytedcli --json cdn domain get --domain api.coze.cn
```

输出包含：
- 基本信息：ID, Name, Status, CNAME, Owner, Host, CreatedAt, UpdatedAt
- Origin：源站列表、端口、SNI
- HTTPS：启用状态、HTTP/2、OCSP、TLS 版本、证书 ID 与过期时间
- Compression：Gzip、Brotli
- Cache：FollowOrigin、RemoveQueryParams
- 其他：IPv6、QUIC、WebSocket

## cdn file

CDN 文件操作，走 CDN 上传服务，需在办公网/VPN 环境执行。共用参数：`--dir`、`--team-space`、`--region`（`INTERNAL|CN|SG|VA2`，默认 `CN`）、`--email`、`--cdn-token`。

```bash
# 上传单个文件到个人空间根目录
bytedcli cdn file upload --file ./demo-icon.png

# 上传到团队空间指定目录并自动刷新
bytedcli cdn file upload --file ./demo-icon.png --team-space demo-team --dir assets --auto-refresh

# 上传海外区域（host 自动切到 ife-cdn.byteintl.net）
bytedcli cdn file upload --file ./demo-icon.png --region SG

# 上传压缩包并解压（本地包，加 --unzip）
bytedcli cdn file upload --unzip --file ./demo-bundle.zip --dir assets

# 上传压缩包并解压（远端 URL）
bytedcli cdn file upload --unzip --url https://example.com/demo-bundle.zip --dir assets

# 删除文件（可选 --auto-refresh 删除后刷新目录）
bytedcli cdn file delete --file demo-icon.png --dir assets --auto-refresh

# 刷新文件
bytedcli cdn file refresh --file demo-icon.png --dir assets

# 列出目录内容
bytedcli cdn file list --dir assets

# JSON 输出
bytedcli --json cdn file upload --file ./demo-icon.png
```

`upload` 默认返回 `cdnUrl`（完整 CDN 加速地址），JSON 模式额外包含 `domain` / `path` / `tosKey`；加 `--unzip` 时把上传内容当压缩包解压，返回解压后的文件 URL 列表。
