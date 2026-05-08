---
name: bytedance-tae
description: "TAE / AI PaaS workflow: search MCP server_id by name/keyword, use first-class bytedcli commands for Agent/Sandbox search/list/get and MCP Server/Tool operations, generate tool_input_schema from Thrift IDL, publish revisions, and verify live config. Use when users mention TAE, AI PaaS, /tae URLs, /ai/agent, /ai/sandbox, /ai/mcp_server URLs, MCP name/keyword lookup, MCP tool 录入/发布, RPC tool creation, or fixing MCP Input Schema on ByteCloud."
---

# bytedcli TAE / AI PaaS

This skill covers TAE / AI PaaS operations. Prefer first-class bytedcli commands for Agent/Sandbox list/get and MCP Server management; unresolved Memory/Skill surfaces are documented as discovered API areas and should be verified before write operations.

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要排错时看：`references/troubleshooting.md`
- 具体 TAE / AI PaaS API 工作流：`references/tae.md`

## When to use

- 用户提到 TAE、AI PaaS、MCP Server、MCP Tool、AI Agent、AI Sandbox、AI Memory、AI Skill。
- 用户给出 `cloud.tiktok-row.net/tae/...`、`/tae/...`、`/ai/...` 页面，尤其是 `/ai/mcp_server`、`/ai/agent`、`/ai/sandbox`、`/ai/memory`、`/ai/skill`。
- 用户只有 MCP 名称 / 关键词，需要查找 `server_id`，不想先提供 URL。
- 用户要查询、新建、更新、发布 MCP Server，或排查 server settings / revision。
- 用户要录入、查询、删除、更新或发布 MCP tools，包括 RPC MCP tool。
- 用户反馈 MCP tool 的 `tool_input_schema` / Input Schema 为空、不正确、缺 description，或模型 structured output 报 schema / `format` 问题。
- 用户要从 Thrift IDL / Kitex RPC method 生成或回写 MCP tool input schema。
- 用户要搜索、查询 TAE Agent / Sandbox 列表或详情。
- 用户要调研 Memory、Skill、A2A Registry、Keys、Security Policy 等 TAE 平台页面/API。
- 用户遇到 TAE 鉴权、401/403、site、region/env 参数相关问题。

## Supported capabilities

- 解析 TAE MCP Server URL，提取 `server_id`、`env`、region。
- 使用 bytedcli 内置认证调用 TAE 命令和已确认的 raw API 路径。
- 列出现有 MCP tools，识别 tool 类型、重复项、空 Input Schema。
- 新建 MCP Server，并在成功后进入 server tools/settings 流程。
- 创建 RPC MCP tools。
- PATCH 更新已有 tools，保留原配置并替换 `tool_input_schema`。
- 从 Thrift IDL 解析 Request struct，生成 JSON Schema。
- 从 IDL 注释补充 schema `description`，解析 enum、nested struct、list/map/set。
- 避免生成空 `format` 字段，兼容 GPT 5.5 structured output。
- 发布 MCP server revision，并重新拉取线上配置做验证。
- 输出批量操作报告，便于超时后定位成功/失败项。
- 使用一等 CLI：`bytedcli tae agent search/list/get` / `bytedcli tae sandbox search/list/get` 查询 Agent/Sandbox，`bytedcli tae mcp server ...` / `bytedcli tae mcp tool ...` 管理 MCP Server 和 Tool，`schema generate/update` 生成并回写 input schema。
- 调研并定位 TAE Memory、Skill、A2A Registry、Keys、Security Policy 等页面对应的前端 API；写操作前需先确认 payload 和权限。

## Quick start

1. 先读 `references/tae.md`。
2. 从 TAE URL 提取 `server_id`、`env`、`x-bc-region-id`。
3. 优先使用 `bytedcli tae agent --help`、`bytedcli tae sandbox --help`、`bytedcli tae mcp server --help` 和 `bytedcli tae mcp tool --help`。
4. 如果 CLI 未覆盖目标能力，再用 `bytedcli tae api ...` 调已确认的 TAE API 路径。
5. 对 RPC tools，用 `bytedcli tae mcp schema generate/update` 从 Thrift IDL 生成真实 `tool_input_schema`，不要输出空 `format`。
6. 批量操作成功后加 `--release` 或单独 release，并重新 list 验证。

## References

- `references/tae.md` — TAE / AI PaaS API 操作指南
- `references/invocation.md` — bytedcli 通用调用方式
- `references/troubleshooting.md` — 通用排障
