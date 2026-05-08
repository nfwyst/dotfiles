---
name: bytedance-faas
description: "Manage ByteCloud FaaS (Serverless) functions via bytedcli: list/get services, clusters, triggers, revisions, templates; view logs; invoke functions; create/abort releases; create/update/delete triggers; remove services and clusters. Use when tasks mention FaaS, Serverless, cloud functions, ByteFaaS, function triggers, function deployment, or function logs."
---

# bytedcli FaaS

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

- 查询 FaaS 服务列表、详情、集群、触发器、代码版本、函数模板
- 查看函数运行日志（支持实时流）
- 调用函数（HTTP / Timer / Kafka / RocketMQ / EventBus / TOS）
- 创建发布（滚动蓝绿部署）、查看发布状态、中止发布
- 创建 / 更新 / 删除触发器（timer、http、kafka 等）
- 删除服务或集群

## 前置条件

- 使用通用调用方式：`references/invocation.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

### 查询服务与集群

```bash
# 列出 FaaS 服务
bytedcli faas function list --limit 10
bytedcli faas function list --search "demo-service" --limit 20

# 查看服务详情
bytedcli faas function get --service-id <service-id>

# 列出集群
bytedcli faas cluster list --service-id <service-id>

# 查看集群详情（单集群服务可省略 --region / --cluster）
bytedcli faas cluster get --service-id <service-id> --region <region> --cluster <cluster>
```

### 触发器

```bash
# 列出触发器
bytedcli faas trigger list --service-id <service-id>

# 查看触发器详情
bytedcli faas trigger get --service-id <service-id> --id <trigger-id>

# 创建 timer 触发器
bytedcli faas trigger create --service-id <service-id> --type timer --name demo-timer --cron "*/10 * * * *" --enabled

# 更新触发器
bytedcli faas trigger update --service-id <service-id> --trigger-id <id> --trigger-type timer --cron "0 * * * *"

# 删除触发器（需 --force）
bytedcli faas trigger delete --service-id <service-id> --trigger-id <id> --trigger-type timer --force
```

### 查看日志

```bash
# 查看最近 10 分钟日志
bytedcli faas log --service-id <service-id>

# 查看最近 1 小时的 stderr 日志
bytedcli faas log --service-id <service-id> --since 1h --type stderr

# 按 pod 过滤
bytedcli faas log --service-id <service-id> --pod <pod-name> --limit 100
```

### 调用函数

```bash
# HTTP 调用
bytedcli faas invoke --service-id <service-id>
bytedcli faas invoke --service-id <service-id> --data '{"key":"value"}' --method POST

# Timer 调用
bytedcli faas invoke --service-id <service-id> --type timer --timer-name demo-timer --data '{}'

# Kafka 调用
bytedcli faas invoke --service-id <service-id> --type kafka --kafka-topic demo-topic --kafka-consumer-group demo-group --data '{"msg":"hello"}'
```

### 发布管理（工单制）

`faas release create` 现在会提交一个发布工单（`tickets/release_clusters`），
由 FaaS 平台异步编排灰度发布。工单信息（ticket id / ticket url）会在结果中返回。

```bash
# 创建工单，使用最新 code revision（默认）
bytedcli faas release create --service-id <service-id>

# 指定 code revision id
bytedcli faas release create --service-id <service-id> --code-revision <rev-id>

# 指定 rolling-step / min-ready-percentage / traffic-ratio
bytedcli faas release create --service-id <service-id> \
  --rolling-step 20 --min-ready-percentage 95 --traffic-ratio 100

# 指定 pipeline-template（平台/服务特定，可从 Web 界面获取）
bytedcli faas release create --service-id <service-id> --pipeline-template <template-id>

# 查看最近发布
bytedcli faas release status --service-id <service-id>

# 列出发布历史
bytedcli faas release list --service-id <service-id>

# 中止发布
bytedcli faas release abort --service-id <service-id>
```

默认参数：`--rolling-step=10`、`--min-ready-percentage=90`、`--rolling-interval=0`、
`--traffic-ratio=100`。

### 代码版本

```bash
# 列出代码版本
bytedcli faas revision list --service-id <service-id>

# 查看版本详情
bytedcli faas revision get --service-id <service-id> --revision <rev>

# 基于最新版本创建一个新版本（克隆字段，仅覆盖指定字段）
bytedcli faas revision create --service-id <service-id> \
  --from-revision latest --number 1.0.65 \
  --source faas/example:demo:1.0.0.95 --description "release 1.0.0.95"
```

### 函数模板

```bash
# 列出可用模板
bytedcli faas template list
bytedcli faas template list --runtime golang/v1

# 查看模板详情
bytedcli faas template get --name <template-name>
```

### 删除资源

```bash
# 删除集群（需 --force）
bytedcli faas remove cluster --service-id <service-id> --region <region> --cluster <cluster> --force

# 删除服务（需 --force，且须先删除所有集群）
bytedcli faas remove service --service-id <service-id> --force
```

## 多站点支持

FaaS 通过 `--site` 切换环境（替代 bytefaas CLI 的 `APP_ENV`）：

```bash
# 中国站（默认）
bytedcli faas function list --limit 10

# BOE 环境
bytedcli --site boe faas function list --limit 10

# TikTok ROW (i18n-tt)
bytedcli --site i18n-tt faas function list --limit 10

# ByteIntl (i18n-bd)
bytedcli --site i18n-bd faas function list --limit 10
```

## 智能集群解析

当目标服务只有一个集群时，`--region` 和 `--cluster` 可以省略，bytedcli 会自动解析。

```bash
# 服务只有一个集群时，以下两种写法等效：
bytedcli faas trigger list --service-id <service-id>
bytedcli faas trigger list --service-id <service-id> --region cn-north --cluster default
```

## Notes

- 需要结构化输出加 `--json`（全局选项，放在子命令之前）
- `--service-id` 是大多数命令的必填参数
- 删除操作（`remove service`、`remove cluster`、`trigger delete`）需要 `--force` 确认
- `faas log` 别名 `faas logs`；`faas remove` 别名 `faas rm`
- `trigger get` / `revision get` / `template get` 均有 `view` 别名

## References

- `references/faas.md`
