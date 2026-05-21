---
name: bytedance-apm
description: "Operate APM via bytedcli: service preview, QPS, upstream/downstream dependency analysis, per-method SLA (success rate, QPS), Redis monitoring dashboards, runtime/TLB/TCC/MySQL/AGW monitoring via Byteheart and Argos, and APM metric querying (with Query DSL, anti-drift duration, multi-region). Use when tasks mention APM, service monitoring, QPS, dependencies, SLA, success rate, metric query, or Redis monitoring."
---

# bytedcli APM

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

- 服务预览、QPS 查询
- 上下游服务依赖分析（deps：查看服务的 upstream/downstream 依赖及其 QPS、错误率、成功率）
- 接口维度 SLA 分析（methods：查看每个 method 的 QPS、成功率，支持按成功率阈值过滤）
- Metric 指标高级查询（Query DSL）及 Metric 探索 (search, field-list, tagk-list, tagv-list)
- Redis 监控（overview/client/server/proxy）
- 运行时 / 中间件监控（runtime/TLB/TCC/MySQL/AGW）

## 前置条件

- 使用通用调用方式：`references/invocation.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

**命令行结构**：`bytedcli [全局选项] apm <子命令族> <子命令> [命令选项]`

| 类别     | 选项                              | 位置                        | 说明                             |
| -------- | --------------------------------- | --------------------------- | -------------------------------- |
| 全局选项 | `--json`、`--site`、`--debug`     | `bytedcli` 之后、子命令之前 | 对所有子命令生效                 |
| 命令选项 | `--psm`、`--region`、`--start` 等 | 子命令之后                  | 仅对当前子命令生效，见参数归属表 |

**必须严格遵守的格式**：`bytedcli --json apm service qps --psm "example.service.api"`（`--json` 在 `apm` 之前）

Commands are grouped under `apm service`, `apm redis`, and `apm metric`. Old flat names (e.g. `apm service-preview`, `apm redis-qps`) still work as hidden aliases.

```bash
# 服务预览
bytedcli --json apm service preview --psm "psm.name" --service-type redis

# QPS
bytedcli --json apm redis qps --psm "cache.demo.redis"
bytedcli --json apm redis traffic --psm "cache.demo.redis"
bytedcli --json apm service qps --psm "example.service.api"
bytedcli --json apm service qps --psm "example.service.api" --metric "service.request.server.throughput.total"
bytedcli --json apm service downstream-qps --psm "example.service.api"
bytedcli --json apm service downstream-qps --psm "example.service.api" --metric "service.request.downstream.throughput.total"

# 上下游服务依赖分析
bytedcli --json apm service deps --psm "example.service.api"
bytedcli --json apm service deps --psm "example.service.api" --direction upstream
bytedcli --json apm service deps --psm "example.service.api" --direction downstream
bytedcli --json apm service deps --psm "example.service.api" --start 1714000000 --end 1714003600
bytedcli --json apm service deps --psm "example.service.api" --region "China-North"

# 接口维度 SLA 分析
bytedcli --json apm service methods --psm "example.service.api"
bytedcli --json apm service methods --psm "example.service.api" --min-success-rate 99.9
bytedcli --json apm service methods --psm "example.service.api" --latency
bytedcli --json apm service methods --psm "example.service.api" --latency --top 10
bytedcli --json apm service methods --psm "example.service.api" --latency --method "QueryHotelDetail"
bytedcli --json apm service methods --psm "example.service.api" --start 1714000000 --end 1714003600 --region "China-North"

# i18n-bd 站点查询（deps / methods / qps / preview 均支持）
bytedcli --site i18n-bd --json apm service deps --psm "example.service.api"
bytedcli --site i18n-bd --json apm service methods --psm "example.service.api"

# Metric 基础查询（单值指标，带必要的 _psm tag）
bytedcli --json apm metric query "sum:bytedtrace.sdk.span.server.rate{}{_psm=literal_or(example.demo.api)}" --start-time 1714000000 --end-time 1714003600 --region "China-North"

# Metric 多值指标查询（delta_counter 类型，[delta] 必须放在末尾）
bytedcli --json apm metric query "sum:store:example.service.api.throughput{_psm=literal_or(example.demo.api)}{}[delta]" --start-time 1714000000 --end-time 1714003600

# Metric 多值指标查询（timer 类型，加权 P99）
bytedcli --json apm metric query "sum:store:example.service.api.latency{_psm=literal_or(example.demo.api)}{}[weighted_avg(value=pct99,weight=counter)]" --start-time 1714000000 --end-time 1714003600

# Redis 监控
bytedcli --json apm redis overview --psm "cache.demo.redis"
bytedcli --json apm redis client --psm "cache.demo.redis"
bytedcli --json apm redis server --psm "cache.demo.redis"
bytedcli --json apm redis proxy --psm "cache.demo.redis"

# 运行时 / 中间件
bytedcli --json apm service preview --psm "psm.name" --service-type runtime
bytedcli --json apm service preview --psm "psm.name" --service-type tlb
bytedcli --json apm service preview --psm "psm.name" --service-type tcc
bytedcli --json apm service preview --psm "psm.name" --service-type mysql
bytedcli --json apm service preview --psm "psm.name" --service-type agw_sidecar

# Argos bosun/data：VMP PromQL 查询（简化模式）
bytedcli --json apm argos bosun query \
  --account-id 1234567890 \
  --workspace-id 00000000-0000-0000-0000-000000000000 \
  --prom 'sum(rate(proxy_requests_total{cluster="demo-cluster"}[1m]))' \
  --duration 1h

# Argos bosun/data：VMP PromQL 查询（passthrough 模式，整段 bosun 表达式）
bytedcli --json apm argos bosun query --expr-file ./panel.bosun --duration 30m
```

## Metric 探索工作流

如果你不确定具体的 metric 名称或 tag，请按以下步骤探索：

1. 查租户 → `tenant-list`
2. 找 metric → `search`
3. 查 tag keys → `tagk-list`
4. 查 tag values → `tagv-list`
5. 查询数据 → `query`

完整的探索指南和高级用法请参考：[exploration-guide.md](./references/exploration-guide.md)、[metric.md](./references/metric.md)

## 参数归属

Agent 在构造命令时，**必须**参照下表判断参数归属。不在表中的参数表示该子命令不支持。

### `apm metric` 系列

| 参数                          |          `query`           |  `search`   | `field-list` | `tagk-list` | `tagv-list` | `tenant-list` |
| ----------------------------- | :------------------------: | :---------: | :----------: | :---------: | :---------: | :-----------: |
| `--region`                    |        ✅ (可多次)         | ✅ (可多次) | ✅ (可多次)  | ✅ (可多次) | ✅ (可多次) |  ✅ (可多次)  |
| `--start-time` / `--end-time` | ✅ (推荐，Unix 秒级时间戳) |     ❌      |      ❌      |     ❌      |     ❌      |      ❌       |
| `--duration`                  |          ⚠️ 废弃           |     ❌      |      ❌      |     ❌      |     ❌      |      ❌       |
| `--group-by-region`           |             ✅             |     ❌      |      ❌      |     ❌      |     ❌      |      ❌       |
| `--tenant`                    |    ✅ (默认 `default`)     |     ✅      |      ✅      |     ✅      |     ✅      |      ❌       |
| `--prefix`                    |             ❌             |  ✅ (必填)  |      ❌      |     ❌      |     ❌      |      ❌       |
| `--metric`                    |             ❌             |     ❌      |  ✅ (必填)   |  ✅ (必填)  |  ✅ (必填)  |      ❌       |
| `--tags`                      |             ❌             |     ❌      |      ❌      |     ❌      |  ✅ (必填)  |      ❌       |
| `--filters`                   |             ❌             |     ❌      |      ❌      |     ❌      |     ✅      |      ❌       |
| `--limit`                     |             ❌             |     ✅      |      ❌      |     ❌      |     ❌      |      ❌       |
| `--psm`                       |   ❌ (写在 query {} 内)    |     ❌      |      ❌      |     ❌      |     ❌      |      ❌       |

### `apm service` 系列

| 参数                 |         `preview`          |           `deps`           |         `methods`          |           `qps`            |      `downstream-qps`      | `runtime/tlb/tcc/mysql/agw-sidecar` |
| -------------------- | :------------------------: | :------------------------: | :------------------------: | :------------------------: | :------------------------: | :---------------------------------: |
| `--psm`              |         ✅ (必填)          |         ✅ (必填)          |         ✅ (必填)          |         ✅ (必填)          |         ✅ (必填)          |              ✅ (必填)              |
| `--region`           |        ✅ (可多次)         |        ✅ (可多次)         |        ✅ (可多次)         |        ✅ (可多次)         |        ✅ (可多次)         |                 ❌                  |
| `--start` / `--end`  | ✅ (推荐，Unix 秒级时间戳) | ✅ (推荐，Unix 秒级时间戳) | ✅ (推荐，Unix 秒级时间戳) | ✅ (推荐，Unix 秒级时间戳) | ✅ (推荐，Unix 秒级时间戳) |                 ❌                  |
| `--range`            |          ⚠️ 废弃           |          ⚠️ 废弃           |          ⚠️ 废弃           |          ⚠️ 废弃           |          ⚠️ 废弃           |                 ❌                  |
| `--service-type`     |             ✅             |             ❌             |             ❌             |             ✅             |             ✅             |              ✅ (预设)              |
| `--direction`        |             ❌             |             ✅             |             ❌             |             ❌             |             ❌             |                 ❌                  |
| `--method`           |             ❌             |             ❌             |             ✅             |             ✅             |             ✅             |                 ❌                  |
| `--metric`           |             ❌             |             ❌             |             ❌             |             ✅             |             ✅             |                 ❌                  |
| `--latency`          |             ❌             |             ❌             |             ✅             |             ❌             |             ❌             |                 ❌                  |
| `--min-success-rate` |             ❌             |             ❌             |             ✅             |             ❌             |             ❌             |                 ❌                  |
| `--top`              |             ❌             |             ❌             |             ✅             |             ❌             |             ❌             |                 ❌                  |
| `--aggregator`       |             ❌             |             ❌             |             ✅             |             ✅             |             ✅             |                 ❌                  |

### `apm redis` 系列

| 参数       |   `qps`   | `traffic` | `overview` | `client`  | `server`  |  `proxy`  |
| ---------- | :-------: | :-------: | :--------: | :-------: | :-------: | :-------: |
| `--psm`    | ✅ (必填) | ✅ (必填) | ✅ (必填)  | ✅ (必填) | ✅ (必填) | ✅ (必填) |
| `--idc`    |    ❌     |    ❌     |     ✅     |    ✅     |    ✅     |    ✅     |
| `--region` |    ❌     |    ❌     |     ❌     |    ❌     |    ❌     |    ❌     |

### 时间戳格式

| 参数                          | 格式            | 示例         | 说明                                                                                                         |
| ----------------------------- | --------------- | ------------ | ------------------------------------------------------------------------------------------------------------ |
| `--start-time` / `--end-time` | Unix 秒级时间戳 | `1714000000` | 仅支持数字时间戳，不支持相对时间                                                                             |
| `--start`                     | Unix 秒级时间戳 | `1714000000` | 也支持 RFC3339 和 `-1h`，但**必须优先使用时间戳**                                                            |
| `--end`                       | Unix 秒级时间戳 | `1714003600` | 同 `--start`，也支持 `now`，但**必须优先使用时间戳**                                                         |
| `--duration` / `--range`      | —               | —            | **⚠️ 废弃**，不要使用。相对时间导致结果不确定，Agent 必须用 `--start-time`/`--end-time` 或 `--start`/`--end` |

**Agent 构造命令时，必须将用户意图转换为 Unix 秒级时间戳。** 示例：用户说"最近 1 小时"，Agent 应计算 `当前时间戳 - 3600` 作为 `--start` 值，`当前时间戳` 作为 `--end` 值。

## Notes

- `apm service deps` 基于 Argos measurement 接口，输出上下游依赖（按 service 聚合）。
  - QPS：`service.request.{downstream|upstream}.throughput.total`
  - Error QPS：`service.request.{downstream|upstream}.throughput.error`
  - Success Rate：基于 `service.request.{downstream|upstream}.error_rate`（成功率 = `100 - error_rate`），避免用数量做除法带来的偏差。
- `apm service methods` 基于 Argos measurement 接口，输出 method 维度指标（按 `method` / `service.method` 聚合，必要时自动 fallback）。
  - Success Rate：基于 `service.request.server.error_rate`（成功率 = `100 - error_rate`，两位小数）。
  - 延迟：用 `--latency` 打开（默认指标 `service.request.server.latency.total`，并自动转成 `ms`）。
  - `--top <n>`：按 `Max QPS` 排序取前 N。
  - `--method <name>`：只看指定方法（可重复/逗号分隔）。
- `apm service deps` 和 `apm service methods` 均支持 `--site i18n-bd`（映射到 mycis region）和 `--site i18n-tt` 海外查询，以及 `--region`、`--start`/`--end`（Unix 秒级时间戳）参数。`--range` 已废弃，不要使用。
- `apm metric query` 的查询语句是**位置参数**，且**不支持** `--psm` 与 `--query` 参数，请直接将过滤条件（如 `_psm=...`）写在 query 的标签内。
- 部分指标（如 `bytedtrace.sdk.span.server.rate`）有 tag rewrite 逻辑，**必须指定 `_psm` tag** 才能查询，例如：`bytedtrace.sdk.span.server.rate{_psm=literal_or(example.demo.api)}{}`
- Metric 查询格式：`aggregator[:topK][:downsample]:metric_name{group_tags}{filter_tags}[multi_field_expr]`，**必须使用** `key=func(value)` 格式，**禁止** `key=value`。`[multi_field_expr]` 仅多值指标需要，**必须放在末尾**。downsample 和 topK 可选；省略 downsample 则服务端 auto（超 24h 建议指定）。详见 [metric.md](./references/metric.md)
- `apm metric query` 支持直接输入前端页面中的 Query DSL 进行解析（支持 `[xxx]` 等多值语法提取），必须用 `--start-time`/`--end-time`（Unix 秒级时间戳）指定时间窗。`--duration` 已废弃，不要使用。支持 `--region` 多次声明以组装数组进行多机房查询。
- `apm service preview/runtime/tlb/tcc/mysql/agw-sidecar` 调用 Byteheart 全局视图接口
- Redis 相关命令返回 Grafana/Argos 监控入口链接（按集群维度）
- `apm service qps` 基于 Argos measurement 接口，可用 `--metric` 指定指标，支持使用 `--region` 参数过滤 vregion；现已支持通过 `--site i18n-tt` 进行海外控制面查询。支持传入多个机房进行正则聚合查询（通过多次指定 `--region A --region B`，或直接传入 `China-North|Singapore-Central` 格式）
- `apm service downstream-qps` 基于 Argos measurement 接口，默认指标为 `service.request.downstream.throughput.total`，用于查看服务调用下游依赖的 QPS，同样支持 `--region` 参数过滤 vregion 以及 `--site i18n-tt` 海外查询。支持传入多个机房进行正则聚合查询（通过多次指定 `--region A --region B`，或直接传入 `China-North|Singapore-Central` 格式）
- `apm redis qps/traffic` 基于 Cache 服务详情的当前统计值
- `apm argos bosun query` 通过 Argos `bosun/data` 接口查询 VMP（Volcengine Managed Prometheus）数据，是 Argos 自定义看板 `query_type: "bosun"` 面板的同条链路；与 `apm bosun query`（走 portal-bosun，OpenTSDB 语法）相互独立。
  - 简化模式：`--prom` + `--account-id` + `--workspace-id`，CLI 自动包装成 `["accountID=…&workspaceID=…"]promql/promras(...)`；用 `--func promras` 切换包装函数（promras 顶层函数必须带 `by` 子句）。
  - Passthrough 模式：`--expr` 或 `--expr-file` 直接传入完整 bosun 表达式（`promras` 多变量组合或从看板面板复制的整段表达式推荐使用此模式）。
  - `--region` 是火山引擎 region（默认 `cn-beijing`），不是 Argos region。
  - 前置条件：火山账号必须先通过 Argos 多云代理工单加入；详见 [`references/vmp-bosun.md`](./references/vmp-bosun.md)。
- **所有 APM 命令必须加 `--json`**。`--json` 是全局选项，**必须放在 `apm` 之前**，不能放在子命令之后。正确：`bytedcli --json apm service qps --psm "example.service.api"`；错误：`bytedcli apm service qps --json --psm "example.service.api"`（虽然不会报错，但不符合规范）

## References

以下文件包含 SKILL.md 未展开的详细内容。**按需读取**——仅当你遇到对应场景时才读取，避免不必要的 tool call。

| 何时读取                                                      | 文件                                                      | 内容                                                                                                      |
| ------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 需要 service/redis 命令的完整参数说明表                       | [apm.md](./references/apm.md)                             | `apm service deps/methods` 的逐项参数表与输出说明                                                         |
| 需要构造 metric query、理解 Query DSL 语法、或解读 query 响应 | [metric.md](./references/metric.md)                       | 5 大探索命令详解、Query DSL 语法、`{}` 双花括号规则、Response 格式（成功/失败判断与字段解读）、常见指标名 |
| 不知道 metric 名或 tag，需要一步步探索                        | [exploration-guide.md](./references/exploration-guide.md) | 从 search → tagk-list → tagv-list → query 的完整场景演示                                                  |
| 需要了解 bytedcli 安装、站点切换、JWT 认证                    | [invocation.md](./references/invocation.md)               | npx/全局安装方式、`--site` 切换、`--json` 用法、HTTP 调试                                                 |
| 命令执行报错，需要排查                                        | [troubleshooting.md](./references/troubleshooting.md)     | 常见错误（未认证、Missing command、metric query 报错等）的原因与处理                                      |
| 需要查询 VMP（Argos bosun/data）PromQL 数据                   | [vmp-bosun.md](./references/vmp-bosun.md)                 | `apm argos bosun query` 简化/passthrough 模式、多云代理前置条件、region 映射、常见 error_code 处理        |
| 修改 skill 后需要回归验证，或查阅验收判断逻辑                 | [maintenance-guide.md](./maintenance-guide.md)            | 回归测试用例（26 个场景）、验收判断逻辑、已踩坑记录、文件职责边界                                         |
| 需要搜索 Argos Trace（按 PSM / 时间窗 / 过滤条件）            | [trace.md](./references/trace.md)                         | `apm argos trace search/categories/dimensions` 参数详解、JSON 输出结构、分页与常见陷阱                    |
