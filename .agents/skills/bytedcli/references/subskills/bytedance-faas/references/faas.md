# FaaS

FaaS 命令按资源分组为 `function`、`cluster`、`trigger`、`revision`、`template`、`release`、`log`、`invoke`、`remove`。

## 服务与集群查询

```bash
# 服务列表（支持搜索、分页）
bytedcli faas function list --limit 10 --search "demo" --env prod
bytedcli faas function list --sort-by "-updated_at" --offset 20

# 服务详情
bytedcli faas function get --service-id <service-id>

# 集群列表
bytedcli faas cluster list --service-id <service-id> --limit 20
bytedcli faas cluster list --service-id <service-id> --region cn-north

# 集群详情（含最新发布状态）
bytedcli faas cluster get --service-id <service-id> --region <region> --cluster <cluster>
```

## 触发器管理

```bash
# 列出触发器
bytedcli faas trigger list --service-id <service-id>

# 查看触发器详情（--id 或 --name 选其一）
bytedcli faas trigger get --service-id <service-id> --id <trigger-id>
bytedcli faas trigger get --service-id <service-id> --name <trigger-name>

# 创建 timer 触发器
bytedcli faas trigger create --service-id <service-id> --type timer --name demo-timer --cron "*/10 * * * *" --enabled

# 创建 HTTP 触发器
bytedcli faas trigger create --service-id <service-id> --type http --name demo-http --path /api/handler --method POST

# 更新触发器
bytedcli faas trigger update --service-id <service-id> --trigger-id <id> --trigger-type timer --cron "0 * * * *" --disabled

# 删除触发器（需 --force）
bytedcli faas trigger delete --service-id <service-id> --trigger-id <id> --trigger-type timer --force
```

## 日志查看

```bash
# 最近 10 分钟日志（默认）
bytedcli faas log --service-id <service-id>

# 指定时间范围和类型
bytedcli faas log --service-id <service-id> --since 1h --type stderr

# 按 pod 过滤
bytedcli faas log --service-id <service-id> --pod <pod-name> --limit 100

# JSON 输出
bytedcli --json faas log --service-id <service-id> --since 30m
```

`--since` 支持 `5s`、`2m`、`3h`、`1d` 格式，默认 `10m`。`--type` 可选 `stdout`、`stderr`、`all`（默认 `all`）。

## 函数调用

```bash
# HTTP 调用（默认 POST）
bytedcli faas invoke --service-id <service-id>
bytedcli faas invoke --service-id <service-id> --data '{"key":"value"}'
bytedcli faas invoke --service-id <service-id> --data-file payload.json --method GET --path /health

# Timer 调用
bytedcli faas invoke --service-id <service-id> --type timer --timer-name demo-timer

# Kafka 调用
bytedcli faas invoke --service-id <service-id> --type kafka --kafka-topic demo-topic --kafka-consumer-group demo-group --data '{"msg":"hello"}'

# RocketMQ 调用
bytedcli faas invoke --service-id <service-id> --type rocketmq --rocketmq-topic demo-topic --rocketmq-consumer-group demo-group

# 显示响应头
bytedcli faas invoke --service-id <service-id> --verbose
```

`--type` 支持：`http`（默认）、`timer`、`kafka`、`rocketmq`、`eventbus`、`tos`。`--timeout` 默认 180 秒。

## 发布管理

```bash
# 创建发布（滚动蓝绿）
bytedcli faas release create --service-id <service-id>
bytedcli faas release create --service-id <service-id> --code-revision 1.0.5 --ratio 50 --rolling-step 10
bytedcli faas release create --service-id <service-id> --approver demo-user

# 查看当前发布状态
bytedcli faas release status --service-id <service-id>

# 列出发布历史
bytedcli faas release list --service-id <service-id> --limit 10

# 中止发布
bytedcli faas release abort --service-id <service-id>
```

`--ratio` 指定最大流量百分比（0-100，默认 100）。`--rolling-step` 指定每步流量迁移百分比（默认 20）。

## 代码版本

```bash
# 列出代码版本
bytedcli faas revision list --service-id <service-id> --limit 10

# 查看版本详情
bytedcli faas revision get --service-id <service-id> --revision <rev>
```

## 函数模板

```bash
# 列出可用模板
bytedcli faas template list
bytedcli faas template list --runtime golang/v1

# 查看模板详情
bytedcli faas template get --name <template-name>
```

## 删除资源

```bash
# 删除集群
bytedcli faas remove cluster --service-id <service-id> --region <region> --cluster <cluster> --force

# 删除服务（须先删除所有集群）
bytedcli faas remove service --service-id <service-id> --force
```

**警告：** 删除操作不可逆。必须传 `--force` 确认。非交互模式下（`--json` 或 pipe）也需要显式传 `--force`。

## 多站点

通过 `--site` 切换（等价于 bytefaas CLI 的 `APP_ENV`）：

| `--site` | 等价 `APP_ENV` | 说明 |
|----------|----------------|------|
| `cn` | `production` | 中国站（默认） |
| `boe` | `boe` | BOE 测试 |
| `i18n-bd` | `i18n` | ByteIntl |
| `i18n-tt` | `i18n` | TikTok ROW |

```bash
bytedcli --site boe faas function list --limit 10
bytedcli --site i18n-tt faas log --service-id <service-id>
```

## 智能集群解析

单集群服务可省略 `--region` 和 `--cluster`；多集群时必须指定，否则报错并列出可用集群。
