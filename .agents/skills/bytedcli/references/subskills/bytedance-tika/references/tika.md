# Tika 命令参考

## 命令列表

### tika chat

与 Tika AI 对话（自动创建会话 + 流式输出）。

```bash
bytedcli tika chat --message <message> [options]
```

| 参数 | 说明 |
|------|------|
| `--message <message>` | **必填** 问题文本 |
| `--conversation-id <id>` | 续用已有会话 |
| `--space-id <space_id>` | 知识空间 ID（默认: Tika 公共知识库） |
| `--model <model>` | AI 模型名（如 `gemini_2.5_pro`、`gpt_4.1_mini`、`tika-deepseek-v3.2`） |
| `--no-stream` | 等待完整回答后再输出 |
| `--search-mode <mode>` | 搜索模式（默认: `fast_agent`） |
| `--timeout-sec <seconds>` | 请求超时（秒） |

### tika conversations

列出最近的 Tika 对话及消息摘要。

```bash
bytedcli tika conversations [options]
```

| 参数 | 说明 |
|------|------|
| `--space-id <space_id>` | 知识空间 ID |
| `--page-size <size>` | 返回条数（默认: 20） |

### tika models

列出 Tika 可用的 AI 模型。

```bash
bytedcli tika models
```

### tika spaces

列出 Tika 知识空间。

```bash
bytedcli tika spaces
```

## 可用模型

| 模型名 | 显示名 | 推理 | 备注 |
|--------|--------|------|------|
| `gemini_2.5_pro` | Gemini 2.5 Pro | ✓ | 默认模型 |
| `gemini_2.5_flash` | Gemini 2.5 Flash | | 快速响应 |
| `gpt_4.1` | GPT-4.1 | | |
| `gpt_4.1_mini` | GPT-4.1 mini | | 快速响应 |
| `gpt_5_mini` | GPT-5 mini | ✓ | |
| `tika-deepseek-v3.2` | DeepSeek V3.2 | ✓ | 内部模型，数据不出域 |
| `tika_seed_2.0_lite` | Doubao Seed 2.0 Lite | ✓ | 内部模型，数据不出域 |

> 完整列表通过 `bytedcli tika models` 获取。

## 认证

Tika 复用 ByteCloud SSO 认证，JWT 通过 `cloud-i18n.byteintl.net`（region: `i18n`）获取。

```bash
# 先登录
bytedcli auth login

# 验证（应返回用户信息）
bytedcli tika spaces
```

## 错误处理

| 错误 | 原因 | 解决 |
|------|------|------|
| HTTP 401 / Signature verification failed | JWT 过期或 region 不匹配 | 重新 `auth login` |
| Tika API error | 业务层错误 | 检查参数，确认 space_id 有效 |
| TIKA_TIMEOUT | 请求超时 | 用 `--timeout-sec` 增加超时 |
