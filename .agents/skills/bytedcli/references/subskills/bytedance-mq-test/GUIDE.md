---
name: bytedance-mq-test
description: "MQ testing helper for dev self-testing : find BMQ/Kafka topics, produce test messages, consume messages, construct message payloads. Use when tasks mention MQ testing, send BMQ/Kafka message, produce message to topic, consume MQ messages, message queue self-test, or BMQ testing."
---

# bytedcli MQ Test

研发自测场景下的消息队列（MQ / BMQ / Kafka）测试辅助 skill。帮助研发快速完成：查找目标队列 → 构造消息 → 发送消息 → 消费验证 的自测闭环。

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

- 研发自测时需要往指定 BMQ/Kafka topic 发送测试消息
- 需要消费某个 topic 的消息来验证业务逻辑
- 不确定目标 topic 信息，需要先查找再操作
- 需要辅助构造符合业务 schema 的 MQ 消息体
- 联调场景下需要快速模拟上游 MQ 消息触发下游处理

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要鉴权时先登录：`bytedcli auth login`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## 核心流程

MQ 自测分三步：**找队列 → 发消息 → 收消息**。根据需要可以只执行其中一步或多步组合。

### 路径 A：查找目标队列

用于确认 topic 名称、所属集群、分区数等元信息。

```bash
# 按名称搜索 topic
bytedcli bmq topic list --vregion "US-BOE" --search "demo-order-event" --all

# 查看 topic 详情（获取集群名、分区数、owner 等）
bytedcli bmq topic get --topic-id 12345 --vregion "US-BOE"

# 查看关联的消费组
bytedcli bmq consumer list --vregion "US-BOE" --search "demo-order" --all

# 查看集群信息
bytedcli bmq cluster list --vregion "US-BOE" --search "demo-cluster"
```

**JSON 模式**（适合 agent 或脚本消费）：

```bash
bytedcli --json bmq topic list --vregion "US-BOE" --search "demo-order-event" --all
```

### 路径 B：发送测试消息

通过 `api-test` 的 HTTP/RPC 调用能力，向目标服务的 MQ 生产接口发送测试消息。

```bash
# 方式 1：通过服务 HTTP 接口发送（适用于服务暴露了 MQ 生产 HTTP 端点）
bytedcli api-test http-call "example.producer.service" \
  --http-method POST \
  --http-path "/api/v1/mq/produce" \
  --env boe \
  --idc lf \
  --body '{"topic":"demo-order-event","key":"order-001","value":"{\"orderId\":\"demo-001\",\"status\":\"created\",\"timestamp\":1700000000}"}'

# 方式 2：通过 RPC 接口发送
bytedcli api-test rpc-call "example.producer.service" "ProduceMessage" \
  --idl-version "1.0.0" \
  --env boe \
  --idc lf \
  --body '{"topic":"demo-order-event","key":"order-001","payload":"{\"orderId\":\"demo-001\",\"status\":\"created\"}"}'

# 方式 3：从文件加载消息体（适用于复杂 payload）
bytedcli api-test http-call "example.producer.service" \
  --http-method POST \
  --http-path "/api/v1/mq/produce" \
  --env boe \
  --idc lf \
  --body-file ./test-message.json
```

### 路径 C：消费消息验证

通过 `api-test` 调用消费侧接口，查看消息是否正确到达。

```bash
# 通过服务 HTTP 接口消费/查看最近消息
bytedcli api-test http-call "example.consumer.service" \
  --http-path "/api/v1/mq/messages?topic=demo-order-event&group=demo-consumer-group&count=5" \
  --env boe \
  --idc lf

# 通过 RPC 接口消费
bytedcli api-test rpc-call "example.consumer.service" "ConsumeMessages" \
  --idl-version "1.0.0" \
  --env boe \
  --idc lf \
  --body '{"topic":"demo-order-event","consumerGroup":"demo-consumer-group","maxMessages":5}'
```

## 消息构造指引

构造测试消息时建议遵循以下模式：

```json
{
  "topic": "demo-order-event",
  "key": "demo-unique-key-001",
  "value": "{\"bizField1\":\"value1\",\"bizField2\":123,\"timestamp\":1700000000}",
  "headers": {
    "x-trace-id": "test-trace-001",
    "x-source": "mq-self-test"
  }
}
```

**构造建议**：
- `key`：使用有辨识度的前缀（如 `test-`、`debug-`），方便后续在日志中搜索
- `value`：JSON 字符串，内容与业务 schema 对齐
- `headers`：建议携带 `x-trace-id` 方便链路追踪，携带 `x-source` 标识来源为自测
- BOE 环境优先：自测消息优先发往 BOE 环境，避免影响线上数据

## 典型自测场景

### 场景 1：验证下游消费逻辑

```bash
# 1. 查找目标 topic
bytedcli --json bmq topic list --vregion "US-BOE" --search "demo-order-event" --all

# 2. 发送测试消息
bytedcli api-test http-call "example.producer.service" \
  --http-method POST \
  --http-path "/api/v1/mq/produce" \
  --env boe --idc lf \
  --body '{"topic":"demo-order-event","key":"test-001","value":"{\"orderId\":\"test-001\",\"action\":\"create\"}"}'

# 3. 检查消费结果
bytedcli api-test http-call "example.consumer.service" \
  --http-path "/api/v1/mq/consume-status?topic=demo-order-event&key=test-001" \
  --env boe --idc lf
```

### 场景 2：批量发送压测消息

```bash
# 准备消息文件 messages.json
# 循环发送（shell 示例）
for i in $(seq 1 10); do
  bytedcli api-test http-call "example.producer.service" \
    --http-method POST \
    --http-path "/api/v1/mq/produce" \
    --env boe --idc lf \
    --body "{\"topic\":\"demo-order-event\",\"key\":\"batch-test-${i}\",\"value\":\"{\\\"orderId\\\":\\\"batch-${i}\\\",\\\"status\\\":\\\"created\\\"}\"}"
done
```

## 多站点支持

BMQ 查询支持多站点，通过 `--site` 切换：

```bash
# BOE 环境（推荐自测使用）
bytedcli --site boe bmq topic list --vregion "US-BOE" --search "demo-topic"

# TikTok ROW
bytedcli --site i18n-tt bmq topic list --vregion "Singapore-Central" --search "demo-topic"
```

## Notes

- 自测消息**务必使用 BOE 环境**，避免污染线上数据
- 发送消息前先通过路径 A 确认 topic 存在且状态正常
- 消息 key 使用 `test-` / `debug-` 前缀，方便事后清理和日志检索
- 需要结构化输出加 `--json`（全局参数，放在子命令前）
- 复杂消息体建议使用 `--body-file` 从文件加载，避免 shell 转义问题

## 约束

- 不要向生产环境 topic 发送测试消息
- 不要在消息体中包含真实用户数据，使用 `demo-*`、`test-*` 占位值
- 本 skill 不直接操作 Kafka 协议层，而是通过业务服务的 HTTP/RPC 接口间接操作

## References

- `references/mq-test.md`
- `references/invocation.md`
- `references/troubleshooting.md`
