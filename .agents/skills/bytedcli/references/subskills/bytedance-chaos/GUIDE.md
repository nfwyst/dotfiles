---
name: bytedance-chaos
description: 'ByteHAS Chaos AI Agent skill，提供混沌工程演练方案创建、故障注入诊断、方案新鲜度检查等能力。当用户请求"混沌演练"、"故障注入"、"演练方案"、"方案新鲜度"、"chaos"、"bytehas"等时使用。'
---

# bytedcli chaos

ByteHAS Chaos Engineering platform — 目前支持通过 A2A Agent 管理演练方案。

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要有效的 ByteCloud SSO 登录态（JWT 认证）
- **仅支持 `--site cn`、`--vregion China-North`**，其他站点/地域暂不可用

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

---

## 命令结构

```
chaos
└── solution              — 演练方案管理
    └── agent             — 通过 A2A Agent 交互（当前唯一入口）
```

未来可能扩展：`chaos risk agent`、`chaos trace agent`、`chaos solution mcp` 等。

---

## 可用子 Agent（--subagent）

| 子 Agent | 用途 | 默认 |
|----------|------|------|
| `core` | 通用 Agent，自动路由到合适的子 Agent 或直接回答混沌工程相关问题 | ✅ |
| `solution_creator` | 创建混沌演练方案 | |
| `fault_inject_debug` | 排查故障注入不生效的问题 | |
| `solution_freshness` | 检查演练方案的新鲜度 | |

---

## chaos solution agent

### 通用对话（core，默认）

不指定 `--subagent` 时默认走 `core`，它是通用入口，可以自动路由到合适的子 Agent，也能直接回答混沌工程相关问题。

```bash
# 通用对话：让 core agent 自动判断并处理
bytedcli chaos solution agent \
  --message "服务 a.b.c 注入 cpu 故障" \
  --username demo-user

# 直接问答
bytedcli chaos solution agent \
  --message "什么是混沌工程？" \
  --username demo-user
```

### 创建演练方案（solution_creator）

方案创建依赖五类信息：**空间、链路、故障、流量、环境**。其中链路和故障必须提供，其余可选（Agent 会自动推理）。

```bash
# 最小示例：指定链路 + 故障（空间/流量/环境自动推理）
bytedcli chaos solution agent \
  --message "服务 psm 为 a.b.c，注入 cpu 故障" \
  --subagent solution_creator \
  --username demo-user

# 指定上下游链路 + mesh 故障
bytedcli chaos solution agent \
  --message "上游 psm 为 a.b.c，下游 d.e.f，注入 mesh 拒绝故障，时长3分钟" \
  --subagent solution_creator \
  --username demo-user

# 指定空间 + 链路 + 故障 + 流量 + 环境
bytedcli chaos solution agent \
  --message "使用 ID 为 123 的空间，上游 a.b.c 注入方法 MethodA 访问下游 d.e.f 的故障，注入 redis 故障方法为 get，使用最新的 rhino 流量，使用 ppe_test 环境" \
  --subagent solution_creator \
  --username demo-user

# 不代理流量 + 新建隔离环境
bytedcli chaos solution agent \
  --message "服务 a.b.c 注入杀死进程的故障，进程名为 demo_process，不代理流量" \
  --subagent solution_creator \
  --username demo-user
```

### 故障注入诊断（fault_inject_debug）

```bash
bytedcli chaos solution agent \
  --message "帮我排查这次故障注入为什么不生效" \
  --subagent fault_inject_debug \
  --execute-id "exec_123456" \
  --job-name "demo_job"
```

### 方案新鲜度检查（solution_freshness）

```bash
bytedcli chaos solution agent \
  --message "检查这个方案是否过期" \
  --subagent solution_freshness \
  --username demo-user \
  --solution-id "sol_789"
```

---

## 参数说明

| 参数 | 说明 |
|------|------|
| `--message <text>` | **必填**，发送给 Agent 的消息文本 |
| `--subagent <name>` | 目标子 agent，默认 `core`（通用 Agent） |
| `--username <name>` | 用户名（用于 Agent 内部鉴权和上下文） |
| `--solution-id <id>` | 方案 ID（solution_freshness 子 agent 使用） |
| `--execute-id <id>` | 执行 ID（fault_inject_debug 子 agent 使用） |
| `--job-name <name>` | 任务名（fault_inject_debug 子 agent 使用） |

---

## 典型使用场景

| 场景 | 命令示例 |
|------|----------|
| 通用对话（默认 core） | `chaos solution agent --message "服务 a.b.c 注入 cpu 故障"` |
| 指定 solution_creator 创建方案 | `chaos solution agent --message "上游 a.b.c 下游 d.e.f，注入 mesh 拒绝故障" --subagent solution_creator` |
| 故障注入诊断 | `chaos solution agent --message "排查不生效" --subagent fault_inject_debug --execute-id X --job-name Y` |
| 方案新鲜度检查 | `chaos solution agent --message "检查方案是否过期" --subagent solution_freshness --solution-id X` |

### Prompt 编写要点（solution_creator）

| 信息 | 是否必须 | 说明 |
|------|---------|------|
| 空间 | 否 | 未指定则自动推理（用户可用空间 → 默认空间） |
| 链路 | **是** | cpu 故障只需提供目标 psm；mesh 故障至少需上下游 psm |
| 故障 | **是** | 指定类型和参数，未指定参数则用默认值 |
| 流量 | 否（建议指定） | 支持 rhino/tesla 流量或不代理流量 |
| 环境 | 否 | 默认新建隔离环境，支持指定 ppe 环境 |

---

## Notes

- 默认 `--subagent` 为 `core`（通用 Agent，可自动路由到子 Agent）
- 超时为 5 分钟（300s），与生产环境配置一致
- 可通过环境变量 `BYTEDCLI_CHAOS_API_BASE_URL` 覆盖 FaaS 地址

---

## References

- `references/invocation.md` — 通用调用方式
- `references/a2a-protocol.md` — A2A 协议说明
- `references/troubleshooting.md` — 常见问题与处理
