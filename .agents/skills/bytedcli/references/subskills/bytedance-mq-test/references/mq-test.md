# MQ Test

## 查找队列

```bash
# 搜索 topic
bytedcli bmq topic list --vregion "US-BOE" --search "demo-order-event" --all

# topic 详情
bytedcli bmq topic get --topic-id 12345 --vregion "US-BOE"

# 消费组
bytedcli bmq consumer list --vregion "US-BOE" --search "demo-order" --all

# 集群
bytedcli bmq cluster list --vregion "US-BOE" --search "demo-cluster"

# JSON 输出
bytedcli --json bmq topic list --vregion "US-BOE" --search "demo-order-event" --all
```

## 发送消息

```bash
# HTTP 方式
bytedcli api-test http-call "example.producer.service" \
  --http-method POST \
  --http-path "/api/v1/mq/produce" \
  --env boe \
  --idc lf \
  --body '{"topic":"demo-order-event","key":"order-001","value":"{\"orderId\":\"demo-001\",\"status\":\"created\"}"}'

# RPC 方式
bytedcli api-test rpc-call "example.producer.service" "ProduceMessage" \
  --idl-version "1.0.0" \
  --env boe \
  --idc lf \
  --body '{"topic":"demo-order-event","key":"order-001","payload":"{\"orderId\":\"demo-001\"}"}'

# 从文件加载
bytedcli api-test http-call "example.producer.service" \
  --http-method POST \
  --http-path "/api/v1/mq/produce" \
  --env boe \
  --idc lf \
  --body-file ./test-message.json
```

## 消费消息

```bash
# HTTP 方式
bytedcli api-test http-call "example.consumer.service" \
  --http-path "/api/v1/mq/messages?topic=demo-order-event&group=demo-consumer-group&count=5" \
  --env boe \
  --idc lf

# RPC 方式
bytedcli api-test rpc-call "example.consumer.service" "ConsumeMessages" \
  --idl-version "1.0.0" \
  --env boe \
  --idc lf \
  --body '{"topic":"demo-order-event","consumerGroup":"demo-consumer-group","maxMessages":5}'
```

## 消息体模板

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

## 多站点

```bash
# BOE（推荐自测）
bytedcli --site boe bmq topic list --vregion "US-BOE" --search "demo-topic"

# TikTok ROW
bytedcli --site i18n-tt bmq topic list --vregion "Singapore-Central" --search "demo-topic"
```
