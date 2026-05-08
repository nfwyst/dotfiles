# ByteDog Domains

## Console Domains (Office Network)

Use these for API calls from your development machine. Requires `X-Jwt-Token` header.

| Site | Console Domain |
|------|---------------|
| CN | `bytedog.bytedance.net` |
| BOE | `bytedog-boe.bytedance.net` |
| I18N | `bytedog-i18n.bytedance.net` |
| I18NBD | `bytedog.byteintl.net` |
| EU-TTP | `bytedog.tiktok-eu.net` |
| US-TTP (`us-ttp` / `ttp-us` / `ttp-us-limited`) | `bytedog-bd.tiktok-us.net` (requires `--tce-site ttp-us-limited` to override the `i18n-tt` default on bytedog commands) |
| Volc | `bytedog-volc.bytedance.net` |
| SINF-CN | `bytedog-sinf.bytedance.net` |

## API Domains (Production Network)

These are only accessible from the production network (TCE pods, etc.). NOT reachable from office network.

| Site | API Domain |
|------|-----------|
| CN | `ste-bytedog-api.byted.org` |
| BOE | `ste-bytedog-api-boe.byted.org` |
| I18N | `ste-bytedog-api-i18n.byted.org` |
| I18NBD | `ste-bytedog-api-i18nbd.byted.org` |
| EU-TTP | `bytedog.tiktoke.org` |
| US-TTP | `bytedog-usts.tiktokd.org` |
| SINF-CN | `ste-bytedog-api-sinf.byted.org` |

## MCP Servers

- CN: `https://cloud.bytedance.net/ai/mcp_server/5ayursv4/tools?x-resource-account=public&x-bc-region-id=bytedance`
- ROW: `https://cloud-i18n.bytedance.net/ai/mcp_server/pq9drqch/tools?x-resource-account=i18n&x-bc-region-id=bytedance`

## Wiki

ByteDog Open API documentation: https://bytedance.larkoffice.com/wiki/wikcnaQO59RmnX9Tkil8j6zqRbh
