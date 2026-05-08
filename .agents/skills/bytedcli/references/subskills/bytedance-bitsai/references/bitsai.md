# BitsAI 专属约定

## 认证

BitsAI 复用 bytedcli 通用认证：

```bash
bytedcli auth status
bytedcli auth login
bytedcli auth set-bytecloud-jwt-token <jwt>
```

## 会话策略

- 单轮问答默认用 `bitsai ask`
- 连续追问优先复用 `--conversation-id`
- 长对话使用 `bitsai interactive`
- 只有在主题完全切换、旧上下文明显会误导时，才考虑新建会话

## 输出策略

- 文本模式默认流式输出，适合直接面向用户回答
- `--json` 模式适合 agent 解析
- 不对最终用户暴露 JWT、内部 endpoint 或其他鉴权细节

## 上下文注入原则

- 只有在用户明确提供标识时，才加 `--tce` / `--tcc` / `--faas` / `--goofy`
- 不猜 PSM、函数名或 Goofy appid
- 当用户只是泛泛询问平台知识时，不要强行附加项目上下文
