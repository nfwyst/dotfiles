# RMQ (RocketMQ)

```bash
# Topic 列表（按名称搜索）
bytedcli rmq topic list --vregion "China-BOE" --search "demo_topic"
bytedcli rmq topic list --vregion "China-BOE" --page 1 --page-size 20

# Topic 详情（按 ID 查询）
bytedcli rmq topic get --topic-id 132991 --vregion "China-BOE"

# Consumer Group 列表（按 Topic ID 查询）
bytedcli rmq consumer list --topic-id 132991 --vregion "China-BOE"

# 消费状态（TPS、Lag、Queue 详情）
bytedcli rmq consumer stats --topic demo-topic --group demo-group --cluster demo-cluster --vregion "China-BOE"
# 查看 Lag 最高的前 5 个队列
bytedcli rmq consumer stats --topic demo-topic --group demo-group --cluster demo-cluster --top-lag-queue 5

# Queue 分配状态（按 Broker Cluster → Proxy 展示）
bytedcli rmq consumer allocation --topic demo-topic --group demo-group --cluster demo-cluster --vregion "China-BOE"
# 筛选指定 Broker 和 Queue 对应的 Proxy 信息
bytedcli rmq consumer allocation --topic demo-topic --group demo-group --cluster demo-cluster --broker demo-broker --queue 0

# 客户端连接状态（按 Broker Cluster → Proxy → Client 连接串展示）
bytedcli rmq consumer clients --topic demo-topic --group demo-group --cluster demo-cluster --vregion "China-BOE"
# 筛选指定 Proxy 的 Client 信息
bytedcli rmq consumer clients --topic demo-topic --group demo-group --cluster demo-cluster --proxy 10.0.0.1

# 多站点（中国站）
bytedcli --site cn rmq topic list --vregion "CN" --search "demo"

# BOE 站点
bytedcli --site boe rmq topic list --vregion "China-BOE" --all
```
