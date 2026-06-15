---
name: openclaw-config
description: Manage OpenClaw bot configuration - channels, agents, security, gateway, cron, memory, skills, and multi-agent orchestration
version: 4.0.0
---

# OpenClaw Operations Runbook

环境: ghostty + tmux + starship + nushell + bun + bunx + uv

> **注意**: 本文档中所有命令均适配 nushell 语法。bash 命令仅在 `bash -c "..."` 包裹时使用。
> 包管理优先级: bun > npm, bunx > npx, uv > pip。
> **禁止执行 `openclaw doctor --fix`。**

---

## Quick Health Check

出现问题时首先运行:

```nu
# Gateway 进程检查
ps | where name =~ openclaw | length

# 配置 JSON 有效性
open ~/.openclaw/openclaw.json | to json | ignore; echo "JSON: OK"

# 频道状态
open ~/.openclaw/openclaw.json | get channels | transpose key val | each {|r| $"($r.key): policy=($r.val.dmPolicy? | default 'n/a') enabled=($r.val.enabled? | default 'implicit')" }

# 插件状态
open ~/.openclaw/openclaw.json | get plugins.entries | transpose key val | each {|r| $"($r.key): ($r.val.enabled)" }

# Cron 概览
open ~/.openclaw/cron/jobs.json | get jobs | each {|j| $"($j.name): enabled=($j.enabled) status=($j.state.lastStatus? | default 'never')" }

# 内存数据库
sqlite3 ~/.openclaw/memory/main.sqlite "SELECT COUNT(*) || ' chunks, ' || (SELECT COUNT(*) FROM files) || ' files indexed' FROM chunks;"

# 最近错误
tail -10 ~/.openclaw/logs/gateway.err.log
```

### CLI 健康检查梯队（按顺序执行）

```bash
openclaw status --all
openclaw gateway status --deep
openclaw health --json
openclaw channels status --probe
openclaw logs --follow
```

---

## CLI 命令速查

### Gateway

| 命令 | 作用 |
|---|---|
| `openclaw gateway` | 启动 gateway（`--port`/`--force`/`--verbose`/`--allow-unconfigured`） |
| `openclaw gateway status --deep` | 运行状态 + RPC 探针 |
| `openclaw gateway install` | 安装为系统服务（launchd/systemd） |
| `openclaw gateway restart` | 重启 |
| `openclaw gateway stop` | 停止 |
| `openclaw gateway call <method>` | RPC 调用 |
| `openclaw status --all` | 本地综合诊断 |
| `openclaw health --json` | 完整健康快照 |
| `openclaw logs --follow` | 实时日志 |
| `openclaw doctor` | 诊断修复（**禁止加 --fix**） |
| `openclaw update` | 更新 OpenClaw |
| `openclaw backup` | 备份状态 |

### 配置

| 命令 | 作用 |
|---|---|
| `openclaw config get <key>` | 读取配置值（点号 / 方括号记法） |
| `openclaw config set <key> <value>` | 写入配置值 |
| `openclaw config unset <key>` | 删除配置键 |
| `openclaw config file` | 显示配置文件路径 |
| `openclaw config schema` | 查看 JSON Schema |
| `openclaw config validate` | 校验配置 |
| `openclaw secrets reload` | 运行时重新加载密钥 |

### 频道

| 命令 | 作用 |
|---|---|
| `openclaw channels login` | 认证频道 |
| `openclaw channels logout` | 登出频道 |
| `openclaw channels status --probe` | 频道状态探针 |
| `openclaw channels list` | 列出频道 |
| `openclaw channels add` | 添加频道 |
| `openclaw pairing list` | 列出配对状态 |

### Agent & 会话

| 命令 | 作用 |
|---|---|
| `openclaw agents add <id>` | 新增隔离 Agent |
| `openclaw agents list --bindings` | 列出 Agent 及绑定 |
| `openclaw sessions list` | 列出会话 |
| `openclaw sessions history` | 会话历史 |
| `openclaw sessions cleanup --dry-run` | 清理会话 |

### Cron

| 命令 | 作用 |
|---|---|
| `openclaw cron add` | 添加定时任务（`--name`/`--at`/`--every`/`--cron`/`--tz`/`--session`/`--message`/`--model`/`--agent`） |
| `openclaw cron list` | 列出任务 |
| `openclaw cron edit <jobId>` | 编辑任务 |
| `openclaw cron run <jobId>` | 手动触发 |
| `openclaw cron runs --id <jobId>` | 运行历史 |
| `openclaw cron remove <jobId>` | 删除任务 |
| `openclaw cron status` | 调度器状态 |

### MCP

| 命令 | 作用 |
|---|---|
| `openclaw mcp serve` | 作为 MCP Server 运行 |
| `openclaw mcp list` | 列出已注册的 MCP Server |
| `openclaw mcp show [name]` | 查看定义详情 |
| `openclaw mcp set <name> <json>` | 保存 MCP Server 定义 |
| `openclaw mcp unset <name>` | 移除 MCP Server 定义 |

### 其它

| 命令 | 作用 |
|---|---|
| `openclaw browser status/start/profiles` | 浏览器工具 |
| `openclaw voicecall call/status/end` | 语音通话 |
| `openclaw memory status --deep` | 内存搜索状态 |
| `openclaw models status` | 模型状态 |
| `openclaw nodes status` | 配对节点状态 |
| `openclaw plugins install <pkg>` | 安装插件 |
| `openclaw dashboard` | 打开 Web 面板 |
| `openclaw onboard` | 引导式安装 |
| `openclaw configure` | 配置向导 |

---

## File Map

```
~/.openclaw/
├── openclaw.json                    # 主配置 (JSON5, 支持注释/尾逗号)
├── openclaw.json.bak*               # 自动备份
├── .env                             # 全局环境变量
├── exec-approvals.json              # exec 审批配置
│
├── agents/<agentId>/
│   ├── agent/
│   │   └── auth-profiles.json       # 模型认证 Token
│   └── sessions/
│       ├── sessions.json            # 会话索引
│       └── *.jsonl                  # 会话转录
│
├── workspace/                       # Agent 工作区 (可 git 管理)
│   ├── SOUL.md                      # 人格/语气/风格
│   ├── IDENTITY.md                  # 名称/形象/emoji
│   ├── USER.md                      # 用户偏好
│   ├── AGENTS.md                    # 行为规则/安全策略
│   ├── BOOT.md                      # 启动指令
│   ├── HEARTBEAT.md                 # 心跳任务清单 (空 = 跳过)
│   ├── MEMORY.md                    # 策划的长期记忆
│   ├── TOOLS.md                     # 工具备注 (联系人/SSH/设备)
│   ├── BOOTSTRAP.md                 # 首次运行仪式
│   ├── memory/                      # 每日日志 YYYY-MM-DD.md
│   ├── skills/                      # 工作区级 Skills
│   └── canvas/                      # Canvas UI 文件
│
├── memory/<agentId>.sqlite          # 向量记忆数据库 (SQLite + 嵌入)
│
├── logs/
│   ├── gateway.log                  # 运行日志: 启动/频道初始化/配置重载/关闭
│   ├── gateway.err.log              # 错误日志: 连接断开/API 失败/超时
│   └── commands.log                 # 命令执行日志
│
├── cron/
│   ├── jobs.json                    # 任务定义
│   └── runs/<jobId>.jsonl           # 运行日志
│
├── credentials/
│   ├── whatsapp/<accountId>/        # Baileys 会话 (~1400 文件)
│   ├── telegram/<botname>/token.txt # Bot Token
│   ├── oauth.json                   # OAuth Token
│   └── bird/cookies.json            # X/Twitter cookies
│
├── skills/                          # 共享/托管 Skills
├── extensions/<name>/               # 自定义插件 (TypeScript)
├── sandboxes/                       # 沙盒工作区
├── identity/                        # device.json, device-auth.json
├── devices/                         # paired.json, pending.json
├── media/inbound/                   # 接收的媒体文件
├── media/browser/                   # 浏览器截图
├── browser/openclaw/user-data/      # Chromium 配置
├── tools/signal-cli/                # Signal CLI 二进制
├── subagents/runs.json              # 子 Agent 日志
├── canvas/                          # Canvas HTML
└── telegram/
    └── update-offset-*.json         # Telegram 轮询游标
```

---

## 配置文件结构

配置文件 `~/.openclaw/openclaw.json` 使用 JSON5 格式, 支持:
- 注释 (`//` 和 `/* */`)
- 尾逗号
- `$include` 拆分 (最多 10 层)
- `${VAR_NAME}` 环境变量替换
- SecretRef 对象 (`source: env | file | exec`)
- Gateway 热重载 (文件变更自动生效)

### 顶层结构

```json5
{
  gateway: {
    port: 18789,              // --port > OPENCLAW_GATEWAY_PORT > config > 18789
    bind: "loopback",         // loopback | lan | tailnet | 自定义地址
    auth: { token, password, mode },
    reload: { mode: "hybrid", debounceMs },
    push: { apns: {} },
    channelHealthCheckMinutes: 5,
    channelStaleEventThresholdMinutes: 30,
    channelMaxRestartsPerHour: 10,
  },
  agents: {
    defaults: {
      workspace, model: { primary, fallbacks }, models: {},
      heartbeat: { every, target, directPolicy },
      memorySearch: {}, sandbox: { mode, scope },
      skills: [], bootstrapMaxChars, bootstrapTotalMaxChars,
      maxConcurrent, compaction: {},
    },
    list: [{ id, name, default, workspace, agentDir, model, identity, groupChat, sandbox, tools, skills }],
  },
  channels: { whatsapp: {}, telegram: {}, discord: {}, slack: {}, signal: {}, imessage: {}, googlechat: {}, bluebubbles: {}, irc: {}, qq: {} },
  bindings: [{ agentId, match: { channel, accountId, peer, guildId, teamId, roles } }],
  session: {
    dmScope: "main",          // main | per-peer | per-channel-peer | per-account-channel-peer
    threadBindings: { enabled, idleHours, maxAgeHours },
    reset: { mode: "daily", atHour: 4, idleMinutes },
  },
  tools: {
    allow, deny, profile,     // full | coding | messaging | minimal
    byProvider: {},
    agentToAgent: { enabled, allow },
    exec: {}, media: {},
  },
  cron: { enabled, store, maxConcurrentRuns, retry: {}, webhookToken, sessionRetention, runLog: {} },
  hooks: { enabled, token, path, defaultSessionKey, mappings: [], gmail: {} },
  plugins: { entries: {}, allow: [] },
  mcp: { servers: {} },
  memory: { backend, citations, qmd: {} },
  env: { vars: {}, shellEnv: { enabled, timeoutMs } },
  secrets: { providers: {} },
  browser: { executablePath, profiles: {}, ssrfPolicy: {} },
  messages: { tts: {}, queue: {}, groupChat: {} },
  ui: {}, logging: {}, identity: {}, broadcast: {},
}
```

### 热重载规则

| 模式 (`gateway.reload.mode`) | 行为 |
|---|---|
| `hybrid` (默认) | 安全变更热生效, 关键变更自动重启 |
| `hot` | 仅热生效安全变更, 关键变更仅告警 |
| `restart` | 任何变更都重启 |
| `off` | 关闭文件监听 |

**无需重启**: channels, agents, models, hooks, cron, sessions, tools, browser, skills, bindings, logging, UI
**需要重启**: gateway.* (port, bind, auth, TLS), discovery, canvasHost, plugins

---

## Troubleshooting: WhatsApp

### 消息发送了但无回复

```nu
# 1. 检查 bot 是否在运行
open ~/.openclaw/logs/gateway.log | lines | where ($it | str contains "whatsapp") and ($it | str contains "starting" or "listening") | last 5

# 2. 检查 408 超时断连 (WhatsApp web 经常断)
open ~/.openclaw/logs/gateway.err.log | lines | where ($it | str contains "408") or ($it | str contains "retry") | last 10
# "Retry 1/12" 正常自动恢复, 到 12/12 则完全断连

# 3. 检查跨频道拦截
open ~/.openclaw/logs/gateway.err.log | lines | where $it | str contains "cross-context" | last 5

# 4. 检查会话是否存在
open ~/.openclaw/agents/main/sessions/sessions.json | transpose key val | where ($key | str contains "whatsapp") | select key val.origin.label?

# 5. 检查 DM 策略
open ~/.openclaw/openclaw.json | get channels.whatsapp | select dmPolicy? allowFrom? selfChatMode? groupPolicy?
# dmPolicy=allowlist 且发送者不在 allowFrom 中 → 消息静默丢弃

# 6. 检查 Agent 阻塞
open ~/.openclaw/logs/gateway.err.log | lines | where ($it | str contains "lane wait") or ($it | str contains "embedded run timeout") | last 5
```

### WhatsApp 完全断连

```nu
# 检查凭证文件 (正常 ~1400 个)
ls ~/.openclaw/credentials/whatsapp/default/ | length

# 如果为 0: 重新配对
# openclaw configure

# 检查 Baileys 错误
open ~/.openclaw/logs/gateway.err.log | lines | where ($it | str contains "baileys") or ($it | str contains "DisconnectReason") or ($it | str contains "logout") | last 20
```

---

## Troubleshooting: Telegram

### Bot 无响应或遗忘

```nu
# 1. 配置校验 — 必须用 botToken 不是 token
open ~/.openclaw/openclaw.json | get channels.telegram

# 2. 轮询状态 — getUpdates 超时意味着断连
open ~/.openclaw/logs/gateway.err.log | lines | where ($it | str contains "telegram") and (($it | str contains "exit") or ($it | str contains "timeout") or ($it | str contains "getUpdates")) | last 10
# 修复: openclaw gateway restart

# 3. 轮询偏移
ls ~/.openclaw/telegram/update-offset-*.json | each {|f| $"($f.name): (open $f.name)" }

# 4. 会话和压缩 (compaction = 上下文被裁剪 = "遗忘")
open ~/.openclaw/agents/main/sessions/sessions.json | transpose key val | where ($key | str contains "telegram") | each {|r| $"($r.key) | ($r.val.origin.label? | default '?')" }
```

### Telegram 配置模板

```json5
{
  channels: {
    telegram: {
      enabled: true,
      accounts: {
        mybot: {
          name: "Bot Display Name",
          enabled: true,
          botToken: "your-bot-token-here"  // 注意: 是 botToken 不是 token
        }
      },
      dmPolicy: "pairing",
      groupPolicy: "disabled"
    }
  }
}
```

---

## Troubleshooting: Signal

### RPC 发送失败

```nu
# 1. signal-cli 进程状态
ps | where name =~ "signal-cli"

# 2. RPC 端点
open ~/.openclaw/logs/gateway.log | lines | where ($it | str contains "signal") and ($it | str contains "starting") | last 5

# 3. 连接稳定性
open ~/.openclaw/logs/gateway.err.log | lines | where ($it | str contains "HikariPool") or ($it | str contains "SSE stream error") | last 10

# 4. 限流
open ~/.openclaw/logs/gateway.err.log | lines | where ($it | str contains "signal") and ($it | str contains "rate") | last 5

# 5. 目标格式错误 — 必须用电话号码或 uuid:ID
open ~/.openclaw/logs/gateway.err.log | lines | where $it | str contains "unknown target" | last 5
```

---

## Troubleshooting: Cron

```nu
# 所有任务概览
open ~/.openclaw/cron/jobs.json | get jobs | select name enabled state.lastStatus?

# 失败任务详情
open ~/.openclaw/cron/jobs.json | get jobs | where state.lastStatus? == "error" | select name state.lastError? id

# 常见失败原因:
# - "Signal RPC -1" → signal-cli 守护进程挂了
# - "gateway timeout after 10000ms" → gateway 重启期间 cron 触发
# - "Brave Search 429" → 免费额度用完 (2000 req/month)
# - "embedded run timeout" → 任务超 600s

# 下次运行时间
open ~/.openclaw/cron/jobs.json | get jobs | where enabled | each {|j| $"($j.name): ($j.state.nextRunAtMs? | default 0 | into int | $in * 1_000_000 | into datetime)" }

# 临时禁用故障任务
# openclaw cron edit <jobId> --disable
```

---

## Troubleshooting: Memory / "它忘了"

记忆系统有 3 层, "遗忘" 时逐层排查:

### Layer 1: 上下文窗口 (会话内)

```nu
# 压缩次数 (compaction = 旧消息被裁剪)
open ~/.openclaw/agents/main/sessions/SESSION_ID.jsonl | lines | where ($it | str contains "compaction") | length

# 压缩模式
open ~/.openclaw/openclaw.json | get agents.defaults.compaction?
# "safeguard" = 仅在触及上下文限制时压缩
```

### Layer 2: 工作区记忆文件

```nu
ls ~/.openclaw/workspace/memory/
cat ~/.openclaw/workspace/MEMORY.md
# 搜索
grep -ri "KEYWORD" ~/.openclaw/workspace/memory/
```

### Layer 3: 向量记忆库 (SQLite + 嵌入)

```bash
# 已索引文件
sqlite3 ~/.openclaw/memory/main.sqlite "SELECT path, size, datetime(mtime/1000, 'unixepoch') as modified FROM files;"

# 全文搜索
sqlite3 ~/.openclaw/memory/main.sqlite "SELECT substr(text, 1, 200) FROM chunks_fts WHERE chunks_fts MATCH 'KEYWORD' LIMIT 5;"

# 嵌入限流检查
grep -i "RESOURCE_EXHAUSTED\|429" ~/.openclaw/logs/gateway.err.log | tail -10

# 重建索引 (删库重启, 自动重建):
# rm ~/.openclaw/memory/main.sqlite && openclaw gateway restart
```

**嵌入提供者 (自动检测顺序)**: local → OpenAI → Gemini → Voyage → Mistral → Ollama

---

## Searching Sessions

```nu
# 按名字搜索
open ~/.openclaw/agents/main/sessions/sessions.json | transpose key val | where ($val.origin.label? | default "" | str contains -i "NAME") | each {|r| $"($r.val.sessionId) | ($r.val.lastChannel?) | ($r.val.origin.label?)" }

# 按频道过滤
open ~/.openclaw/agents/main/sessions/sessions.json | transpose key val | where ($val.lastChannel? == "whatsapp") | each {|r| $"($r.val.sessionId) | ($r.val.origin.label? | default $r.key)" }

# 最近会话
open ~/.openclaw/agents/main/sessions/sessions.json | transpose key val | sort-by -r { $in.val.updatedAt? | default 0 } | first 10 | each {|r| $"($r.val.updatedAt? | default 0 | into int | $in * 1_000_000 | into datetime) | ($r.val.lastChannel? | default 'cron') | ($r.val.origin.label? | default $r.key)" }

# 跨会话关键词搜索
grep -l "KEYWORD" ~/.openclaw/agents/main/sessions/*.jsonl
```

---

## Config Editing

### 安全编辑模式

**使用 openclaw CLI (推荐):**
```bash
openclaw config set channels.whatsapp.dmPolicy "allowlist"
openclaw config set channels.whatsapp.allowFrom '["[ph_PHONE_NUMBER_2_ph]"]' --strict-json
```

**使用 jq 手动编辑:**
```nu
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak.manual
# 编辑后验证:
openclaw config validate
openclaw gateway restart
```

### 常见编辑

```bash
# 切换 WhatsApp 为 allowlist
openclaw config set channels.whatsapp.dmPolicy "allowlist"
openclaw config set channels.whatsapp.allowFrom '["[ph_PHONE_NUMBER_2_ph]"]' --strict-json

# 切换模型
openclaw config set agents.defaults.model.primary "anthropic/claude-sonnet-4"

# 设置并发
openclaw config set agents.defaults.maxConcurrent 10

# 禁用插件
openclaw config set plugins.entries.imessage.enabled false
```

### 从备份恢复

```nu
# 最新备份
cp ~/.openclaw/openclaw.json.bak ~/.openclaw/openclaw.json

# 列出备份
ls ~/.openclaw/openclaw.json.bak* | sort-by modified -r

# 验证
openclaw config validate
```

---

## Channel Security Modes

| Mode | 行为 | 风险 |
|---|---|---|
| `open` + `allowFrom: ["*"]` | 所有人可发消息, bot 回复所有 | **高** — 消耗 API 额度, bot 以你身份发言 |
| `allowlist` + `allowFrom: ["+1..."]` | 仅列表中的号码通过 | 低 |
| `pairing` | 未知发送者需审批 | 低 |
| `disabled` | 频道完全关闭 | 无 |

### 检查安全态势

```nu
open ~/.openclaw/openclaw.json | get channels | transpose key ch | each {|r|
  $"($r.key): policy=($r.ch.dmPolicy? | default 'n/a') groups=($r.ch.groupPolicy? | default 'n/a') enabled=($r.ch.enabled? | default 'implicit')"
}
```

### 工具权限组

| 组 | 包含工具 |
|---|---|
| `group:runtime` | exec, bash, process, code_execution |
| `group:fs` | read, write, edit, apply_patch |
| `group:sessions` | sessions_list/history/send/spawn/yield, subagents |
| `group:memory` | memory_search, memory_get |
| `group:web` | web_search, x_search, web_fetch |
| `group:ui` | browser, canvas |
| `group:automation` | cron, gateway |
| `group:messaging` | message |
| `group:nodes` | nodes |
| `group:openclaw` | 所有内置工具 |

---

## Workspace Files

| 文件 | 用途 | 何时编辑 |
|---|---|---|
| `SOUL.md` | 人格: 语气、风格 | 改变 bot 说话方式 |
| `IDENTITY.md` | 名称、形象、emoji | 重新品牌化 |
| `USER.md` | 用户信息和偏好 | 用户上下文变化时 |
| `AGENTS.md` | 行为规则: 记忆/安全/群聊/心跳 | 改变 bot 行为 |
| `BOOT.md` | 启动指令 (开机通知协议) | 改变启动行为 |
| `HEARTBEAT.md` | 心跳清单 (空 = 不执行) | 增减周期任务 |
| `MEMORY.md` | 策划的长期记忆 | Bot 自管理 |
| `TOOLS.md` | 联系人/SSH/设备 | 增加工具备注 |
| `BOOTSTRAP.md` | 首次运行仪式 | 首次设置 |

---

## Session JSONL Format

每行一个 JSON 对象, `type` 字段:

| type | 内容 |
|---|---|
| `session` | 会话头: id, timestamp, cwd |
| `message` | 对话轮次: role (user/assistant/toolResult), content, model, usage |
| `custom` | 元数据: model-snapshot, cache-ttl |
| `compaction` | 上下文窗口被裁剪 |
| `model_change` | 模型切换 |
| `thinking_level_change` | 思考级别调整 |

### Session Key 格式

```
agent:<agentId>:<mainKey>                              # DM (主)
agent:<agentId>:<channel>:group:<id>                   # 群组
agent:<agentId>:<channel>:channel:<id>                 # 房间
agent:main:telegram:group:-1001234567890:topic:42      # Telegram 论坛
agent:main:discord:channel:123456:thread:987654        # Discord 帖子
```

### DM 作用域 (`session.dmScope`)

| 值 | 行为 |
|---|---|
| `main` (默认) | 所有 DM 共享一个会话 |
| `per-peer` | 按发送者 ID 隔离 |
| `per-channel-peer` | 按频道+发送者隔离 (多用户推荐) |
| `per-account-channel-peer` | 按账号+频道+发送者隔离 |

---

## Gateway Startup

### 快速启动

```bash
# 启动 (默认端口 18789)
openclaw gateway --port 18789

# 调试模式
openclaw gateway --port 18789 --verbose

# 强制重启 (先杀死现有监听)
openclaw gateway --force
```

### 端口优先级

`--port` > `OPENCLAW_GATEWAY_PORT` > `gateway.port` > `18789`

### 绑定优先级

CLI override > `gateway.bind` > `loopback`

### 安装为系统服务

```bash
# macOS (launchd): Label ai.openclaw.gateway
openclaw gateway install

# Linux (systemd user)
openclaw gateway install
systemctl --user enable --now openclaw-gateway.service
sudo loginctl enable-linger $USER
```

### 正常启动序列 (~3 秒)

```
[heartbeat] started
[gateway] listening on ws://127.0.0.1:18789
[browser/service] Browser control service ready
[hooks] loaded N internal hook handlers
[whatsapp] [default] starting provider
[signal] [default] starting provider (http://127.0.0.1:8080)
[telegram] [botname] starting provider
[whatsapp] Listening for personal WhatsApp inbound messages.
```

如果任何行缺失, 该组件启动失败, 查看 `gateway.err.log`。

### 运行时协议

- 单端口复用: WebSocket 控制/RPC, HTTP API (OpenAI 兼容), Control UI, Hooks
- OpenAI 兼容端点: `/v1/models`, `/v1/embeddings`, `/v1/chat/completions`, `/v1/responses`
- 首帧必须是 `connect`, Gateway 返回 `hello-ok` 快照

---

## Known Error Patterns

| 错误 | 含义 | 修复 |
|---|---|---|
| `Web connection closed (status 408)` | WhatsApp web 超时, 自动重试 12 次 | 通常自愈; 到 12/12 则 `openclaw gateway restart` |
| `Signal RPC -1: Failed to send message` | signal-cli 断连 | `openclaw gateway restart` |
| `Signal RPC -5: rate limiting` | Signal 限流 | 降低发送频率 |
| `No profile name set` (signal-cli WARN) | 刷日志, 无害 | `signal-cli -a +ACCT updateProfile --given-name "Name"` |
| `Cross-context messaging denied` | Agent 跨频道发送被拦截 | 安全特性; 消息须从正确频道会话发起 |
| `getUpdates timed out after 500 seconds` | Telegram bot 轮询断连 | `openclaw gateway restart` |
| `Unrecognized keys: "token", "username"` | Telegram 配置键错误 | 改用 `botToken` |
| `RESOURCE_EXHAUSTED` (Gemini 429) | 嵌入限流 | 减少工作区文件变动 / 升级配额 |
| `lane wait exceeded` | Agent 被长 LLM 调用阻塞 | 等待或超 2 分钟后重启 |
| `embedded run timeout: timeoutMs=600000` | Agent 响应超 10 分钟 | 拆分为更小任务 |
| `gateway timeout after 10000ms` | Gateway 重启期间不可达 | 瞬态 — cron 在 gateway 停机时触发 |
| `refusing to bind ... without auth` | 非回环绑定无认证 | 设置 `gateway.auth.token` 或 `password` |
| `EADDRINUSE` | 端口冲突 | 使用 `--force` 或手动杀进程 |

---

## Extending OpenClaw

### 扩展层级

| 层 | 用途 | 位置 | 添加方式 |
|---|---|---|---|
| **Skills** | 知识 + 工作流 | `~/.openclaw/workspace/skills/` 或 `~/.openclaw/skills/` | `clawhub install <slug>` |
| **Extensions** | 自定义频道插件 | `~/.openclaw/extensions/<name>/` | TypeScript 开发 |
| **Channels** | 消息平台 | `openclaw.json → channels.*` | 配置 + 凭证 |
| **Cron** | 定时自治任务 | `~/.openclaw/cron/jobs.json` | CLI 或直接编辑 |
| **Plugins** | npm 包 (频道/模型/工具/语音) | `plugins.entries` | `openclaw plugins install <pkg>` |
| **MCP** | 外部 MCP Server 集成 | `mcp.servers` | `openclaw mcp set` |

### Skills: ClawHub

```bash
# 搜索 (向量搜索)
clawhub search "postgres optimization"

# 安装
clawhub install supabase-postgres-best-practices

# 列出已安装
clawhub list

# 更新所有
clawhub update --all

# 发布
clawhub login
clawhub publish ./my-skill --slug my-skill --name "My Skill" --version 1.0.0
```

### 创建 Skill

```
my-skill/
├── SKILL.md              # 必需: YAML frontmatter + 指令
├── scripts/              # 可选: 可执行脚本
├── references/           # 可选: 按需加载的文档
└── assets/               # 可选: 模板/图片
```

**SKILL.md 格式:**
```markdown
---
name: my-skill
description: 做什么 + 何时触发。description 是主要触发器 — Agent 据此决定是否加载完整 Skill。
---

# My Skill

指令内容。仅在 Skill 触发后加载。
保持在 500 行以内, 大内容拆到 references/。
```

### Multi-Agent Orchestration

OpenClaw 支持多个隔离 Agent, 每个有独立工作区、会话和工具配置。

**Agent 绑定优先级** (从高到低): peer > parentPeer > guildId+roles > guildId > teamId > accountId > channel > default

**Agent 间通信** (需开启):
```json5
tools: { agentToAgent: { enabled: true, allow: ["agent-b"] } }
```

**后台 Agent 工作流 (tmux):**

```bash
# 在 tmux 新窗格中启动编码 Agent
tmux split-window -h "codex exec --full-auto 'Build a REST API'"

# 或用 openclaw 内置子 Agent:
# bash pty:true background:true workdir:~/project command:"codex exec 'task'"
```

> **环境适配**: 我们在 ghostty + tmux 环境中工作, 启动子 Agent 时:
> - 使用 `tmux split-window` 或 `tmux new-window` 而非裸 `bash`
> - 需要长时间运行的 Agent 任务, 使用 tmux `detach` 保护
> - nushell 下使用 `^command` 语法调用外部命令

### MCP Server 集成

**OpenClaw 作为 MCP Server:**
```bash
openclaw mcp serve --url ws://127.0.0.1:18789 --token $OPENCLAW_GATEWAY_TOKEN
```

提供工具: `conversations_list`, `conversation_get`, `messages_read`, `messages_send`, `events_poll`, `attachments_fetch`, `permissions_list_open`, `permissions_respond`

**OpenClaw 作为 MCP Client:**
```bash
# 注册外部 MCP Server
openclaw mcp set my-server '{"command": ["bunx", "my-mcp-server"], "transport": "stdio"}'

# 支持的传输协议: stdio, SSE/HTTP, streamable-http
```

### Voice Call

```bash
# 检查插件
openclaw config get plugins.entries.voice-call

# 发起通话
openclaw voicecall call --to "+1234567890" --message "Hello"

# 支持: Twilio, Telnyx, Plivo
```

### Canvas

将 HTML/应用推送到连接的设备 (Mac/iOS/Android):

```bash
openclaw nodes status
ls ~/.openclaw/canvas/
```

---

## 环境特定注意事项

### Ghostty Terminal

- OpenClaw 的浏览器截图和媒体预览在 Ghostty 中正常显示
- 使用 Ghostty 的 `shell-integration` 特性可改善命令跟踪

### tmux 集成

- Gateway 日志可用 `tmux split-window "openclaw logs --follow"` 常驻
- kill-pane 时注意 nushell 无 SIGHUP 处理: 先 `kill -9 #{pane_pid}` 再 `kill-pane`
- cron 任务和子 Agent 推荐在独立 tmux window 中运行

### nushell

- `openclaw` 别名: `bun run ($env.HOME | path join .bun install global node_modules openclaw dist index.js)`
- JSON 解析直接用 nushell 内置: `open file.json | get key`
- 管道操作替代 `jq`: `open ~/.openclaw/openclaw.json | get channels | transpose key val`
- 外部命令需 `^` 前缀: `^openclaw gateway status`

### Starship Prompt

- 长时间的 `openclaw gateway` 进程不会影响 Starship 的命令计时
- 可在 `starship.toml` 中添加自定义模块显示 gateway 状态

### 包管理

| 场景 | 使用 |
|---|---|
| 安装 npm 包 | `bun install` / `bun add` |
| 执行 npx 命令 | `bunx` |
| Python 包 | `uv pip install` |
| Python 脚本 | `uv run` |
| OpenClaw 插件 | `openclaw plugins install` (内部使用 npm, 无需手动) |
| ClawHub Skill | `clawhub install` |

---

## License

MIT
