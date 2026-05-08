# insearch command reference

## insearch query [keyword]

Search across ByteDance internal services.

Options:
- `--keyword <kw>` — search keyword (alternative to positional arg)
- `--source <sources>` — comma-separated: feishu.cn, ask.feishu.cn, cloud.bytedance.net, bytedance.net, bitsai.bytedance.net, bytetech.info (default: all). `feishu.cn` expands to docs + messages + ask.
- `--count <n>` — results per source (default: 10)
- `--offset <n>` — result offset (default: 0)

Examples:

```bash
# Search all sources
bytedcli insearch query "kitex ppe环境"

# Search specific sources
bytedcli insearch query "TCC 配置发布" --source feishu.cn,cloud.bytedance.net

# Search Ask Feishu enterprise Q&A
bytedcli insearch query "如何接入BMQ" --source ask.feishu.cn

# Search with BitsAI for direct answers
bytedcli insearch query "如何接入BMQ" --source bitsai.bytedance.net

# Search ByteTech technical articles
bytedcli insearch query "Openclaw" --source bytetech.info

# JSON output
bytedcli --json insearch query "kitex ppe环境"
```

## insearch get [target]

Get content by URL.

Options:
- `--target <target>` — URL (alternative to positional arg)

Supported URL patterns:
- `*.larkoffice.com/wiki/*` — Feishu wiki doc → markdown
- `*.larkoffice.com/docx/*` — Feishu docx → markdown
- `*.feishu.cn/wiki/*` — Feishu wiki doc → markdown
- `*.feishu.cn/docx/*` — Feishu docx → markdown
- `cloud.bytedance.net/docs/*/wiki/*` — Cloud docs (wiki) → markdown
- `*.bytedance.net/docs/*/wiki/*` — Cloud docs (wiki) → markdown
- `cloud.bytedance.net/docs/product/*` — ByteCloud product docs entry → product metadata and related document URLs
- `bytetech.info/articles/*` — ByteTech article URL → full markdown in text mode; structured detail in `--json`

Examples:

```bash
# Fetch Feishu wiki doc
bytedcli insearch get https://bytedance.larkoffice.com/wiki/xxx

# Fetch Cloud doc
bytedcli insearch get https://cloud.bytedance.net/docs/tcc/wiki/xxx

# Fetch ByteCloud product docs entry and related document URLs
bytedcli insearch get https://cloud.bytedance.net/docs/product/demo-product

# Fetch ByteTech article by URL
bytedcli insearch get https://bytetech.info/articles/12345

# JSON output
bytedcli --json insearch get https://bytedance.larkoffice.com/wiki/xxx
```

## insearch login

Authenticate all search services (SSO session + service sessions).

Triggers SSO login flow and sets up sessions for all supported search backends. If specific services fail, the command reports which services are available and which need additional setup.

```bash
bytedcli insearch login
```

## insearch status

Check authentication status of all search services.

Returns a table showing each service's auth state (ok / expired / not_configured) and instructions for missing credentials.

```bash
bytedcli insearch status
bytedcli --json insearch status
```
