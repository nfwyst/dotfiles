# APM Service & Redis

## 命令行结构

`bytedcli [全局选项] apm <子命令族> <子命令> [命令选项]`

- 全局选项（`--json`、`--site`）放在 `apm` 之前
- 命令选项放在子命令之后
- **所有命令必须加 `--json`**

## apm service deps

查看服务的上下游依赖关系，包含每个依赖的 QPS、错误率和成功率。

| 选项 | 说明 |
|---|---|
| `--psm <psm>` | **必填**，服务 PSM |
| `--direction <dir>` | `upstream`、`downstream` 或 `both`（默认 both） |
| `--start <timestamp>` | 开始时间（推荐 Unix 秒级时间戳，也支持 RFC3339 / `-1h`） |
| `--end <timestamp>` | 结束时间（推荐 Unix 秒级时间戳，也支持 RFC3339 / `now`） |
| `--range <duration>` | ⚠️ 废弃，不要使用 |
| `--region <region...>` | 过滤机房（可多次指定） |

输出内容：
- **Downstream Services**: 下游服务列表，含 Service、QPS、Error Rate、Success Rate
- **Upstream Services**: 上游服务列表，同上

```bash
bytedcli --json apm service deps --psm "example.service.api"
bytedcli --json apm service deps --psm "example.service.api" --direction upstream
bytedcli --json apm service deps --psm "example.service.api" --direction downstream
bytedcli --json apm service deps --psm "example.service.api" --start 1714000000 --end 1714003600
bytedcli --json apm service deps --psm "example.service.api" --region "China-North"
```

## apm service methods

查看服务每个 method 的 QPS 和成功率，支持按成功率阈值过滤异常接口。

| 选项 | 说明 |
|---|---|
| `--psm <psm>` | **必填**，服务 PSM |
| `--min-success-rate <percent>` | 仅显示成功率低于此阈值的方法（如 `99.9`） |
| `--top <n>` | 仅显示 Top N（按 Max QPS） |
| `--method <method>` | 只看指定方法（可多次指定/逗号分隔） |
| `--latency` | 输出方法 P99 延迟（默认指标 `service.request.server.latency.total`，单位 ms） |
| `--latency-metric [name]` | 自定义延迟指标（可选，默认 `service.request.server.latency.total`） |
| `--total-metric <name>` | 自定义总量指标（默认 `service.request.server.throughput.total`） |
| `--error-metric <name>` | 自定义错误指标（默认 `service.request.server.throughput.error`） |
| `--aggregator <name>` | 聚合器（可多次/逗号分隔） |
| `--start <timestamp>` | 开始时间（推荐 Unix 秒级时间戳） |
| `--end <timestamp>` | 结束时间（推荐 Unix 秒级时间戳） |
| `--range <duration>` | ⚠️ 废弃，不要使用 |
| `--region <region...>` | 过滤机房（可多次指定） |

输出内容：
- **Service Methods**: 方法列表，含 Method、QPS、Success Rate
- 若无 per-method 数据，输出 Warning 提示

```bash
bytedcli --json apm service methods --psm "example.service.api"
bytedcli --json apm service methods --psm "example.service.api" --min-success-rate 99.9
bytedcli --json apm service methods --psm "example.service.api" --latency
bytedcli --json apm service methods --psm "example.service.api" --latency --top 10
bytedcli --json apm service methods --psm "example.service.api" --latency --method "QueryFoo"
bytedcli --json apm service methods --psm "example.service.api" --start 1714000000 --end 1714003600 --region "China-North"
```

## apm service qps

查看服务 QPS，支持自定义指标和多机房过滤。

| 选项 | 说明 |
|---|---|
| `--psm <psm>` | **必填**，服务 PSM |
| `--metric <name>` | 指标名（默认 `service.request.server.throughput.total`） |
| `--method <method>` | 过滤方法（可多次/逗号分隔） |
| `--service-type <type>` | 服务类型（默认 `service`） |
| `--aggregator <name>` | 聚合器（可多次/逗号分隔） |
| `--start <timestamp>` | 开始时间 |
| `--end <timestamp>` | 结束时间 |
| `--range <duration>` | ⚠️ 废弃，不要使用 |
| `--region <region...>` | 过滤机房（可多次指定） |

```bash
bytedcli --json apm service qps --psm "example.service.api"
bytedcli --json apm service qps --psm "example.service.api" --metric "service.request.server.throughput.total"
```

## apm service downstream-qps

查看服务调用下游依赖的 QPS。

| 选项 | 说明 |
|---|---|
| `--psm <psm>` | **必填**，服务 PSM |
| `--metric <name>` | 指标名（默认 `service.request.downstream.throughput.total`） |
| `--method <method>` | 过滤方法（可多次/逗号分隔） |
| `--service-type <type>` | 服务类型 |
| `--aggregator <name>` | 聚合器（可多次/逗号分隔） |
| `--start <timestamp>` | 开始时间 |
| `--end <timestamp>` | 结束时间 |
| `--range <duration>` | ⚠️ 废弃，不要使用 |
| `--region <region...>` | 过滤机房（可多次指定） |

```bash
bytedcli --json apm service downstream-qps --psm "example.service.api"
```

## apm service preview

服务预览，支持多种中间件类型。

| 选项 | 说明 |
|---|---|
| `--psm <psm>` | **必填**，服务 PSM |
| `--service-type <type>` | 类型：`service`、`redis`、`mysql`、`runtime`、`tlb`、`tcc`、`agw_sidecar`（默认 `service`） |
| `--start <timestamp>` | 开始时间 |
| `--end <timestamp>` | 结束时间 |
| `--range <duration>` | ⚠️ 废弃，不要使用 |
| `--region <region...>` | 过滤机房（可多次指定） |

```bash
bytedcli --json apm service preview --psm "example.service.api"
bytedcli --json apm service preview --psm "cache.demo.redis" --service-type redis
bytedcli --json apm service preview --psm "example.service.api" --service-type runtime
bytedcli --json apm service preview --psm "example.service.api" --service-type tlb
bytedcli --json apm service preview --psm "example.service.api" --service-type tcc
bytedcli --json apm service preview --psm "example.service.api" --service-type mysql
bytedcli --json apm service preview --psm "example.service.api" --service-type agw_sidecar
```

## i18n 站点查询

deps / methods / qps / preview 均支持 `--site i18n-bd` 和 `--site i18n-tt`：

```bash
bytedcli --site i18n-bd --json apm service deps --psm "example.service.api"
bytedcli --site i18n-tt --json apm service qps --psm "example.service.api"
```

## apm redis

Redis 监控命令，返回 Grafana/Argos 监控入口链接（按集群维度）。

| 子命令 | `--psm` | `--idc` | 说明 |
|--------|---------|---------|------|
| `qps` | ✅ 必填 | ❌ | 基于 Cache 服务详情的当前 QPS 统计 |
| `traffic` | ✅ 必填 | ❌ | 基于 Cache 服务详情的当前流量统计 |
| `overview` | ✅ 必填 | ✅ | Redis 集群概览 |
| `client` | ✅ 必填 | ✅ | 客户端连接信息 |
| `server` | ✅ 必填 | ✅ | 服务端信息 |
| `proxy` | ✅ 必填 | ✅ | 代理信息 |

**注意**：`apm redis` 不支持 `--region`，部分命令使用 `--idc` 过滤机房。

```bash
bytedcli --json apm redis qps --psm "cache.demo.redis"
bytedcli --json apm redis traffic --psm "cache.demo.redis"
bytedcli --json apm redis overview --psm "cache.demo.redis"
bytedcli --json apm redis client --psm "cache.demo.redis" --idc "HLF"
bytedcli --json apm redis server --psm "cache.demo.redis"
bytedcli --json apm redis proxy --psm "cache.demo.redis"
```
