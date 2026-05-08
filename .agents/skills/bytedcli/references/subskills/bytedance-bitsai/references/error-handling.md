# BitsAI 专属错误处理

## Conversation not found / invalid

- 原因：`conversation_id` 已失效或不存在
- 处理：直接重试 `bitsai ask`，或重新执行 `bitsai create-conversation`

## 回答偏泛或缺少项目上下文

- 原因：没有给出明确的 TCE / TCC / FaaS / Goofy 标识
- 处理：只有在用户明确给出标识时，补上 `--tce` / `--tcc` / `--faas` / `--goofy`

## 需要精确结构化字段

- 原因：BitsAI 更适合自然语言问答，不是所有场景都适合直接返回平台原始字段
- 处理：切到对应平台 skill 或 bytedcli 命令，再汇总结果

## 超时或网络问题

- 处理：增大 `--timeout-sec`，或先确认内网与登录状态
