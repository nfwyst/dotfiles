# APM Metric 探索式查询与排障指南

在使用 APM 查询指标时，往往会面临"知道大概长什么样，但拼不出完整名字或 tag"的窘境。
本指南将向你展示一套"循循善诱"的探索工作流，通过组合使用不同指令，一步步拿到最终需要的查询语句。

**所有命令必须加 `--json`**（全局选项，放在 `apm` 之前）。

## 典型工作流

如果你只知道部分指标名 -> 用 `search` 搜索全名 -> 用 `query` 查询 -> 报错提示 multi-field，用 `field-list` 查可用多值 -> 不知道能按什么过滤/分组，或者提示 tagKey 不存在，用 `tagk-list` 查所有可用的 tag -> 用 `tagv-list` 查某个 tag 的可用值 -> 最终再次组合 `query`。

### 如何判断是否是多值指标

判断一个指标是否是多值指标有两种方法：

1. **方法一：先查 field-list**
   执行 `field-list` 命令，如果返回结果非空，说明是多值指标，需要在查询时加上方括号 `[field]`

2. **方法二：通过 query 报错判断**
   先尝试不带方括号执行 `query`，如果报错提示 "multi-field" 相关信息，再回去查 `field-list`

下面用两个场景来演示：

### 场景一：CN 控制面单值指标查询

假设我们要查询 `example.service.api.throughput_rate` 这个指标：

#### 第一步：找对名字 (search)

只知道指标前缀是 `example.service.api`，先用前缀搜索找出完整指标名：

```bash
bytedcli --json apm metric search --prefix "example.service.api"
```
从结果中找到了需要的指标：`example.service.api.throughput_rate`。

#### 第二步：检查是否是多值指标 (field-list)

先通过 field-list 判断是否是多值指标：

```bash
bytedcli --json apm metric field-list --metric "example.service.api.throughput_rate"
```
如果返回结果为空，说明这是一个单值指标，不需要方括号 `[field]`。

#### 第三步：查可用的 Tag Keys (tagk-list)

查看这个指标支持哪些 tag：

```bash
bytedcli --json apm metric tagk-list --metric "example.service.api.throughput_rate"
```
你可以在结果中找到该指标实际支持的维度名称。

#### 第四步：查特定 Tag 的合法值 (tagv-list)

查看某个 tag 的可用值：

```bash
bytedcli --json apm metric tagv-list --metric "example.service.api.throughput_rate" --tags [tag_name]
```

#### 第五步：组装最终查询 (query)

现在组装查询命令，按实际的维度分组：

```bash
bytedcli --json apm metric query "sum:example.service.api.throughput_rate{[tag_name]=literal_or(*),}{}" --start-time 1714000000 --end-time 1714003600
```

**重要说明：**
- 第一个 `{}`：**分组并过滤**，这里放 `[tag_name]=literal_or(*)` 表示按这个 tag 分组
- 第二个 `{}`：**仅过滤**，这里可以放额外的过滤条件
- 不要使用 `key=value` 这种格式，统一使用 `key=func(value)` 的形式，推荐用 `literal_or`

---

### 场景二：i18n-tt 控制面多值指标查询

假设我们要查询 `example.service.api.throughput`（throughput 指标）和 `example.service.api.latency`（latency 指标）：

#### 第一步：找对名字 (search)

在 i18n-tt 控制面按前缀搜索：

```bash
bytedcli --site i18n-tt --json apm metric search --prefix "example.service.api"
```
从结果中找到了需要的指标。

#### 第二步：检查是否是多值指标 (field-list)

先通过 field-list 判断是否是多值指标：

```bash
bytedcli --site i18n-tt --json apm metric field-list --metric "example.service.api.throughput"
```
如果返回结果非空，说明是多值指标，需要在查询时加上方括号 `[field]`。

#### 第三步：查可用的 Tag Keys (tagk-list)

查看指标支持哪些 tag：

```bash
bytedcli --site i18n-tt --json apm metric tagk-list --metric "example.service.api.throughput"
```
你可以在结果中找到类似 `country_code`, `method`, `_psm` 等维度名称。

**注意**：这类指标通常需要指定 `_psm` tag 才能查询。

#### 第四步：查特定 Tag 的合法值 (tagv-list)

查看 `method` tag 的可用值：

```bash
bytedcli --site i18n-tt --json apm metric tagv-list --metric "example.service.api.throughput" --tags method
```

#### 第五步：组装最终查询 (query)

**查询 Throughput（QPS），按 country_code 分组，过滤指定方法：**

```bash
bytedcli --site i18n-tt --json apm metric query "sum:example.service.api.throughput{country_code=literal_or(*),method=literal_or(QueryFoo)}{_psm=literal_or(example.service.api)}[delta]" --start-time 1714000000 --end-time 1714003600 --region Singapore-Central
```

**重要说明：**
- 第一个 `{}`：**分组并过滤**，这里放 `country_code=literal_or(*)` 表示按 country_code 分组，同时 `method=literal_or(QueryFoo)` 过滤特定方法
- 第二个 `{}`：**仅过滤**，这里放 `_psm=literal_or(example.service.api)` 只用于缩小范围
- 不要使用 `key=value` 这种格式，统一使用 `key=func(value)` 的形式，推荐用 `literal_or`
- 如果是单值指标，不需要方括号 `[field]`

### 过滤操作符说明与 `{}` 语法进阶

在编写过滤条件时，**必须使用** `key=func(value)` 的格式，**不要**使用 `key=value` 这种简单格式。默认推荐使用 `literal_or`。

以下是常见过滤操作符：
- `literal_or`：精确匹配多个值，大小写敏感。例如 `_psm=literal_or(example.api,example.rpc)`。
- `iliteral_or`：精确匹配多个值，大小写不敏感。例如 `country_code=iliteral_or(us,my)`。
- `regexp`：支持正则过滤。

**特殊用法：**
- 按某个 tag 分组但不过滤：使用 `key=literal_or(*)`
- 例如：`country_code=literal_or(*)` 表示按 country_code 分组，显示所有国家

#### 双花括号 `{A}{B}` 语法解析

在使用指标查询时，`{}` 的顺序有严格含义：
- 第一个 `{}`：**分组 (Group By) 并过滤**。放在这里的 Tag Key，最终返回的数据会按它拆线/分组。
- 第二个 `{}`：**仅过滤 (Filter Only)**。放在这里的 Tag Key 只用于缩小数据范围，但不会按它分组。
- 同一个 Tag Key 可以在两个 `{}` 里同时出现。

举个例子：如果你想按 `country_code` 拆线（分组），同时只需要看 `_psm` 为 `example.service.api` 且 `method` 为 `QueryFoo` 的数据：
第一步，把 `country_code=literal_or(*)` 和 `method=literal_or(QueryFoo)` 放入第一个 `{}`（分组并过滤）。
第二步，把 `_psm=literal_or(example.service.api)` 放入第二个 `{}`（仅过滤）。

通过这套流程，你可以自主探索所有 APM 指标细节。

## 场景补充：海外站点与多 Region 查询

### 在 i18n-tt 站点使用

对于 TikTok 国际站（i18n-tt），需要显式指定 `--site i18n-tt` 参数：

```bash
bytedcli --site i18n-tt --json apm metric tenant-list
bytedcli --site i18n-tt --json apm metric search --prefix "example.service.api"
```

### 多 Region 联合查询

当需要跨多个机房查询数据时，通过多次声明 `--region` 参数来指定要查询的 region（仅 `apm metric query` 支持多值）：

```bash
bytedcli --site i18n-tt --json apm metric query "sum:example.service.api.monitor{country_code=literal_or(*)}{}" --start-time 1714000000 --end-time 1714003600 --region Singapore-Compliance --region Singapore-Central
```

i18n-tt 站点常用的 region 包括：
- `Singapore-Compliance`
- `Singapore-Central`
- `MY-Compliance`
- `US-East-Compliance`
