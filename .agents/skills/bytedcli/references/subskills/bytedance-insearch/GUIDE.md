---
name: bytedance-insearch
description: "搜索字节跳动内部知识、文档、服务和工具。当用户提问涉及字节内部平台（如 TCC、TCE、Kitex、Hertz、ByteRPC、Neptune、Aeolus、BMQ、Hive、ES 等）、内部文档（飞书文档、ByteCloud 文档）、内部流程（发版、上线、oncall、审批）或需要查找内部资源时使用。Search ByteDance internal knowledge, docs, services and tools. Use when questions involve internal platforms, frameworks, documentation, deployment, oncall, or any ByteDance-specific topic."
---

# bytedcli insearch

Unified search across ByteDance internal services. Use this skill when questions involve ByteDance internal knowledge, tools, services, or documentation.

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

- User asks about ByteDance internal tools (TCC, TCE, Kitex, Hertz, Neptune, Aeolus, etc.)
- User needs to find internal documentation
- User asks about internal processes (deployment, oncall, release, etc.)
- User asks "how to" questions about internal frameworks
- User wants to look up internal service configurations
- User needs answers about ByteDance-specific technology stack

## 前置条件

- 使用通用调用方式：`references/invocation.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

### Search across all sources

```bash
bytedcli insearch query "kitex ppe环境"
bytedcli insearch query "TCC 配置发布"
bytedcli insearch query "如何接入BMQ"
```

### Search specific source

```bash
bytedcli insearch query "kitex ppe" --source feishu.cn
bytedcli insearch query "如何接入BMQ" --source ask.feishu.cn
bytedcli insearch query "TCC SDK" --source cloud.bytedance.net
bytedcli insearch query "kitex如何设置env" --source bitsai.bytedance.net
bytedcli insearch query "Openclaw" --source bytetech.info
```

### Get document content

```bash
bytedcli insearch get https://bytedance.larkoffice.com/wiki/xxx
bytedcli insearch get https://cloud.bytedance.net/docs/tcc/wiki/xxx
bytedcli insearch get https://cloud.bytedance.net/docs/product/demo-product
bytedcli insearch get https://bytetech.info/articles/12345
```

### Check auth status

```bash
bytedcli insearch status
bytedcli insearch login
```

## Available sources

| Source | Description | Auth |
|--------|-------------|------|
| feishu.cn | 飞书/Lark 文档、消息、企业问答聚合别名 | Feishu OAuth + saved Feishu web session |
| ask.feishu.cn | 企业问答 / Feishu Ask | Saved Feishu web session from `auth login --session --feishu` |
| cloud.bytedance.net | ByteCloud documentation | SSO JWT |
| bytedance.net | Internal portal (intranet) | SSO session |
| bitsai.bytedance.net | AI Q&A (BitsAI engineering navigator) | SSO JWT |
| bytetech.info | ByteTech technical articles | SSO JWT |

## Recommended workflow

1. Use `insearch query` to search across all sources: `bytedcli insearch query "your question"`
2. Do not specify `--source` by default; search all sources first, and only narrow to a specific source when you need to load more data from that source.
3. Use `insearch get <url>` to fetch full document content from search results

## Notes

- `--json` is a **global flag** — place it before the subcommand: `bytedcli --json insearch query "xxx"`
- Ask Feishu answers are saved to temp markdown files; the file path is shown in the URL column
- BitsAI answers are saved to temp markdown files; the file path is shown in the URL column
- ByteTech article fetch only supports article URLs; text mode prints full markdown body and `--json` keeps structured fields including `markdown`
- ByteCloud product URLs such as `https://cloud.bytedance.net/docs/product/demo-product` return product metadata plus related document URLs; fetch a related document URL for full document markdown.
- Auth errors include a hint on how to authenticate
- Use `insearch status` to check which sources are available
- 需要结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json insearch query "xxx"`）

## References

- `references/search.md`
- `references/invocation.md`
- `references/troubleshooting.md`
