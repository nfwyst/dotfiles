# A2A 协议说明

ByteHAS Chaos AI Agent 使用 [A2A (Agent-to-Agent)](https://google.github.io/A2A/) JSON-RPC 2.0 协议通信。

## 请求格式

```json
{
  "id": "<uuid>",
  "jsonrpc": "2.0",
  "method": "message/send",
  "params": {
    "message": {
      "messageId": "<uuid>",
      "kind": "message",
      "role": "user",
      "parts": [
        { "kind": "data", "data": { "username": "zhangsan", "solution_id": "123" } },
        { "kind": "text", "text": "检查方案新鲜度" }
      ]
    }
  }
}
```

### Parts 说明

- `kind: "text"` — 自然语言消息内容
- `kind: "data"` — 结构化数据（username、topology、solution_id 等元数据）

## 响应格式

```json
{
  "id": "<same-as-request>",
  "jsonrpc": "2.0",
  "result": {
    "id": "<task-id>",
    "kind": "task",
    "contextId": "<context-id>",
    "status": {
      "state": "completed",
      "message": {
        "role": "agent",
        "parts": [{ "kind": "text", "text": "方案创建成功..." }]
      }
    },
    "history": [...]
  }
}
```

### 响应提取逻辑

1. 优先从 `result.status.message.parts` 中取 `kind=text` 的文本
2. 回退从 `result.history` 最后一条 `role=agent` 消息取文本

## 认证

通过 `x-jwt-token` HTTP header 传递 ByteCloud JWT token。bytedcli 自动从 SSO 登录态获取。

## 端点

| 环境 | Base URL |
|------|----------|
| 生产 | 内置默认值（无需手动配置） |
| 自定义 | 通过 `BYTEDCLI_CHAOS_API_BASE_URL` 环境变量设置 |

### 路由路径

- `/core` — 主 Agent
- `/subagents/solution_creator` — 方案创建
- `/subagents/fault_inject_debug` — 故障注入诊断
- `/subagents/solution_freshness` — 方案新鲜度检查
