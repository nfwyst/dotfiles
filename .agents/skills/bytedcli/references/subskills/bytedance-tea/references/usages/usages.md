# TEA 查询 DSL 规范与使用说明

## 1. 概述

TEA (DataFinder) 通过 OpenAPI 提供数据查询能力，查询条件采用 DSL (Domain Specific Language) 描述，即一个 JSON 格式的文本，用于灵活定义复杂的查询需求。

本文档说明Agent如何动态加载事件分析的必要信息（包括业务事件和其属性、公共事件属性、公共用户属性，按需动态获取属性枚举值），动态构建 DSL，用于 TEA 数据查询和复杂分析。

### 知识库目录结构

存储位置：`${CWD}/tea/`。**由Agent动态构建，用户无需手动维护。Agent定期检查MD文件格式并修复错误。**

```
${CWD}/tea/
├── {project_id}/                 # 项目目录，project_id 为 TEA 项目 ID
│   ├── events/                   # 事件目录
│   │   └── {event_name}/         # 单个事件（event & event_param）
│   │       ├── {event_name}.md        # 事件元信息 + 事件属性列表
│   │       └── {event_name}_enums.md  # 事件属性枚举值
│   ├── any_event/                # 公共事件属性（common_param）
│   │   ├── any_event.md               # 公共事件属性列表, 获取方式：
│   │   └── any_event_enums.md         # 公共事件属性枚举值
│   └── profile_params/           # 公共用户属性（user_profile/profile）
│       ├── profile_params.md          # 用户属性列表
│       └── profile_params_enums.md    # 用户属性枚举值
```

### 知识库动态加载方式

#### 业务事件
**业务事件&属性元信息获取**：

```bash
bytedcli tea get-event \
  --region {region} \
  --events {event_name} \
  --with params,property_dict,alias,event_groups,event_sample \
  --project-id {project_id} \
  --dump /tmp/{project_id}-{event_name}.json \
  --status 0,1,3,4
```

**属性元信息MD生成**:
基于`/tmp/{project_id}-{event_name}.json`生成MD文件，格式参考`references/usages/examples/event_demo.md`，结果为`${CWD}/tea/{project_id}/{event_name}/{event_name}.md`。**生成后校验MD格式并修复错误。**

**单个属性枚举值获取**：
参考`references/usages/examples/event_group_by_param.json`构建dsl，替换`{placeholder}`为实际值，参考`_comment_placeholder`字段说明
```bash
 bytedcli tea query --region {region} --dsl {dsl_str} --json > /tmp/{project_id}-{event_name}-enums-{param_name}.json
```

**属性枚举值MD生成**:
基于`/tmp/{project_id}-{event_name}-enums-{param_name}.json`生成MD文件，格式参考`references/usages/examples/enums_demo.md`，结果增量更新到`${CWD}/tea/{project_id}/{event_name}/{event_name}_enums.md`。**生成后校验MD格式并修复错误。**

#### 公共事件属性
**公共事件属性元信息获取**：

```bash
bytedcli tea get-event \
  --region {region} \
  --events any_event \
  --with params,property_dict,alias,event_groups,event_sample \
  --project-id {project_id} \
  --dump /tmp/{project_id}-any_event.json \
  --status 0,1,3,4
```

**属性元信息MD生成**:
基于`/tmp/{project_id}-any_event.json`生成MD文件，格式参考`references/usages/examples/event-demo.md`，结果为`${CWD}/tea/{project_id}/any_event/any_event.md`。**生成后校验MD格式并修复错误。**

**单个属性枚举值获取**：
参考`references/usages/examples/event_group_by_param.json`构建dsl，参考`_comment_placeholder`字段说明，**event_name为业务事件event_name，param_type为common_param**
```bash
 bytedcli tea query --region {region} --dsl {dsl_str} --json > /tmp/{project_id}-any_event-enums-{param_name}.json
```

**属性枚举值MD生成**:
基于`/tmp/{project_id}-any_event-enums-{param_name}.json`生成MD文件，格式参考`references/usages/examples/enums_demo.md`，结果增量更新到`${CWD}/tea/{project_id}/any_event/any_event_enums.md`。**生成后校验MD格式并修复错误。**

#### 公共用户属性
**公共事件属性元信息获取**：

```bash
bytedcli tea get-profile --region {region} --project-id {project_id} --dump /tmp/{project_id}-profile.json --status 0,1,3,4
```

**属性元信息MD生成**:
基于`/tmp/{project_id}-profile.json`生成MD文件，格式参考`references/usages/examples/event-demo.md`，结果为`${CWD}/tea/{project_id}/profile_params/profile_params.md`。**生成后校验MD格式并修复错误。**

**单个属性枚举值获取**：
参考`references/usages/examples/event_group_by_param.json`构建dsl，参考`_comment_placeholder`字段说明，**event_name为业务事件event_name，param_type为profile**
```bash
 bytedcli tea query --region {region} --dsl {dsl_str} --json > /tmp/{project_id}-profile-enums-{param_name}.json
```

**属性枚举值MD生成**:
基于`/tmp/{project_id}-profile-enums-{param_name}.json`生成MD文件，格式参考`references/usages/examples/enums_demo.md`，结果增量更新到`${CWD}/tea/{project_id}/profile_params/profile_params_enums.md`。**生成后校验MD格式并修复错误。**

## 2. DSL 整体结构

```json
{
  "version": 3,
  "use_app_cloud_id": true,
  "resources": [
    {
      "project_ids": [55],
      "subject_ids": [1],
    }
  ],
  "periods": [],
  "content": {
    "query_type": "event",
    "profile_groups_v2": [],
    "profile_filters": [],
    "orders": [],
    "queries": [[]],
    "page": {},
    "option": {}
  },
  "option": {}
}
```

### 顶层字段说明

| 字段                  | 类型        | 说明                                                                    | 必须 |
| ------------------- | --------- | --------------------------------------------------------------------- | -- |
| version             | int       | DSL 版本，固定为 `3`                                                        | 是  |
| use\_app\_cloud\_id | bool      | 固定为 `true`                                                            | 是  |
| app\_ids            | int\[]    | tea-next 场景不需要填写，传空数组                                                 | 否  |
| resources           | object\[] | 项目资源，`project_ids` 为 TEA 项目 ID（如 TikTok 为 55），`subject_ids` 固定为 `[1]` | 是  |
| periods             | object\[] | 查询时间范围，支持多个                                                           | 是  |
| content             | object    | 查询内容                                                                  | 是  |
| option              | object    | 请求级可选参数，用于控制结果排序、混合对比等展示行为，使用默认配置即可                                   | 否  |

### 顶层 option 默认配置

```json
"option": {
  "blend": {
    "status": true,
    "base": 0,
    "base_period": true
  },
  "transpose": false,
  "finder": {
    "sort_rule": "avg_desc"
  },
  "region_filter": [
    "GLOBAL"
  ]
}
```

| 字段                | 说明                                                                                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| blend             | 混合对比配置，`status` 开启混合，`base` 为基准指标索引，`base_period` 为是否以基准 period 对比                                                                                                                                    |
| transpose         | 是否转置结果                                                                                                                                                                                                |
| finder.sort\_rule | 排序规则，可选值：`avg_desc`(按均值降序) / `avg_asc`(按均值升序) / `sum_desc`(按总和降序) / `sum_asc`(按总和升序) / `name_asc`(按名称升序) / `name_desc`(按名称降序) / `conf_order`(按置信度排序) / `add_sum_desc`(按累加和降序) / `add_sum_asc`(按累加和升序) |
| region\_filter    | 区域过滤，可选值：`GLOBAL`(全球) / `ROW`(其他地区) / `TTP_EU`(欧洲) / `TTP_US`(美国)                                                                                                                                     |

## 3. periods 时间范围

**推荐使用** **`past_range`** **类型**，同时支持固定时间段和相对时间。

### 3.1 固定时间段

```json
{
  "granularity": "day",
  "type": "past_range",
  "spans": [
    { "type": "timestamp", "timestamp": "1704729600" },
    { "type": "timestamp", "timestamp": "1705161599" }
  ],
  "timezone": "UTC",
  "week_start": 1
}
```

### 3.2 相对时间（过去 N 天）

```json
{
  "granularity": "day",
  "type": "past_range",
  "spans": [
    { "type": "past", "past": { "amount": 7, "unit": "day" } },
    { "type": "past", "past": { "amount": 1, "unit": "day" } }
  ],
  "timezone": "UTC",
  "week_start": 1
}
```

### 字段说明

| 字段           | 说明                                                           | 取值                                                                                                                                                            |
| ------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| type         | 时间范围类型                                                       | `past_range`（推荐，同时支持固定和动态时间）                                                                                                                                  |
| granularity  | 时间粒度                                                         | `all`(不拆分) / `second` / `minute` / `five_minute` / `ten_minute` / `fifteen_minute` / `thirty_minute` / `hour` / `day` / `week` / `month` / `quarter` / `year` |
| timezone     | 时区                                                           | 如 `Asia/Shanghai`、`UTC`                                                                                                                                       |
| week\_start  | 周起始日                                                         | 默认 `1`（周一到周日）                                                                                                                                                 |
| align\_unit  | 时间对齐单元                                                       | `day` / `week` / `month` / `hour` / `all`                                                                                                                     |
| spans        | 时间范围列表                                                       | 长度为 2，第一个为开始时间，第二个为结束时间                                                                                                                                       |
| skip\_period | 是否忽略这个period，实际查询时并不会查询这个period，但是结果中仍然会有对应的query id，一般不需要设置 | true/false，默认不传                                                                                                                                               |

#### spans 元素结构

- `type: "timestamp"` — 固定时间点，`timestamp` 为秒级时间戳
- `type: "past"` — 相对时间，`past.amount` 为数量，`past.unit` 为单位（`day`/`week`/`month`/`year`）

## 4. content 查询内容

```json
{
  "query_type": "event",
  "profile_groups_v2": [],
  "profile_filters": [],
  "orders": [],
  "queries": [[]],
  "page": { "limit": 200, "offset": 0 },
  "option": {}
}
```

### 4.1 query\_type 查询类型

| 值 | 含义 | dsl2link `query-type` 参数 |
| --- | --- | --- |
| `event` | 事件查询（最常用） | `event-analysis` |
| `retention` | 留存查询 | `retention-analysis` |
| `funnel` | 转化查询 | `funnel-analysis` |
| `path_find` | 用户路径查询 | `pathfind-analysis` |
| `life_cycle` | 生命周期查询 | `life_cycle-analysis` |
| `web_session` | Web 会话查询 | 暂无明确映射 |
| `event_topk` | TopK 查询 | `distribution-analysis` |
| `ltv` | LTV 查询 | 暂无明确映射 |
| `behavior_attribution` | 归因查询 | 暂无明确映射 |
| `composition` | 成分查询 | `compositon-analysis` |

### 4.2 queries 查询指标

`queries` 是二维数组，外层每个元素代表一个查询指标，内层每个元素是一个 `query_unit`。

当 `query_type = "event"` 时，`query_unit` 有两种形式：

- 普通事件指标：基于具体事件统计 `events`、`event_users`、`uv_per_au`、`measure` 等指标
- 组合指标：基于前面已经定义的事件指标，通过 `formula` 对指标编号做四则运算

```json
{
  "event_name": "app_launch",
  "event_type": "origin",
  "show_name": "应用启动",
  "show_label": "A",
  "event_indicator": "events",
  "measure_info": {},
  "groups_v2": [],
  "filters": []
}
```

`event` 查询下也支持组合指标，格式如下：

```json
[
  [
    {
      "indicator_show_name": "总人数（UV）",
      "measure_info": {},
      "event_indicator": "event_users",
      "show_name": "应用启动",
      "show_label": "A",
      "event_name": "app_launch",
      "event_type": "origin",
      "filters": [],
      "groups_v2": [],
      "extra": {}
    }
  ],
  [
    {
      "indicator_show_name": "总人数（UV）",
      "measure_info": {},
      "event_indicator": "event_users",
      "show_name": "站外视频分享",
      "show_label": "B",
      "event_name": "share_video",
      "event_type": "origin",
      "filters": [],
      "groups_v2": [],
      "extra": {}
    }
  ],
  [
    {
      "show_name": "组合B/A",
      "show_label": "组合B/A",
      "formula": "B/A",
      "combination_format": "number_precision_4"
    }
  ]
]
```

#### query\_unit 字段说明

| 字段               | 类型        | 说明                                                          | 必须                   |
| ---------------- | --------- | ----------------------------------------------------------- | -------------------- |
| event\_name      | string    | 事件名称，来自知识库 `events/` 目录下的事件                                 | 是（与 event\_id 二选一）   |
| event\_id        | int       | 事件 ID                                                       | 是（与 event\_name 二选一） |
| event\_type      | string    | 事件类型：`origin`(原始事件)、`virtual`(虚拟事件)、`bav`(圈选事件)，默认为`origin` | 是                    |
| show\_name       | string    | 查询显示名称                                                      | 否                    |
| show\_label      | string    | 结果标识，如 `A`、`B`、`C`                                          | 否                    |
| event\_indicator | string    | 计算指标（见下表）                                                   | 是                    |
| measure\_info    | object    | `event_indicator` 为 `measure` 时的补充信息                        | 条件必须                 |
| groups\_v2       | object\[] | 事件级分组条件（事件属性或公共事件属性）                                        | 否                    |
| filters          | object\[] | 事件级过滤条件                                                     | 否                    |

#### 组合指标 query\_unit

当 `query_type = "event"` 且当前 `query_unit` 为组合指标时，结构如下：

```json
{
  "show_name": "组合B/A",
  "show_label": "组合B/A",
  "formula": "B/A",
  "combination_format": "number_precision_4"
}
```

| 字段 | 类型 | 说明 | 必须 |
| --- | --- | --- | --- |
| show\_name | string | 组合指标显示名称 | 是 |
| show\_label | string | 组合指标标识 | 是 |
| formula | string | 组合计算公式，引用前面事件指标的 `show_label` | 是 |
| combination\_format | string | 结果格式，如 `number_precision_4` 表示保留 4 位小数 | 否 |

#### formula 规则

- 允许使用事件编号大写字母，如 `A`、`B`、`C`
- 允许使用括号 `()`
- 允许使用加号 `+`、减号 `-`、乘号 `*`、除号 `/`
- 计算公式可任意组合，但仅支持一层括号计算
- `formula` 中引用的指标必须已经在前面的 `queries` 元素中定义

示例：

```text
A/B
(A+B)/C
A-B
A*(B/C)
```

#### event\_indicator 计算指标

| 值                 | 含义                        |
| ----------------- | ------------------------- |
| `events`          | 总次数（PV）                   |
| `event_users`     | 总人数（UV）                   |
| `uv_per_au`       | 渗透率                       |
| `events_per_user` | 人均次数                      |
| `pv_per_au`       | 全活跃用户人均次数                 |
| `measure`         | 自定义计算（需配合 `measure_info`） |

#### measure\_info 自定义计算

当 `event_indicator` 为 `measure` 时使用：

```json
{
  "event_indicator": "measure",
  "measure_info": {
    "measure_type": "sum",
    "property_name": "duration"
  }
}
```

| measure\_type        | 含义           |
| -------------------- | ------------ |
| `sum`                | 按属性求和        |
| `avg`                | 按属性求平均       |
| `max`                | 按属性求最大值      |
| `min`                | 按属性求最小值      |
| `per_user`           | 按属性求人均值      |
| `sum_per_au`         | 按属性求全活跃用户人均值 |
| `pct`                | 按属性求分位数      |
| `distinct`           | 按属性求去重数      |
| `distinct_user_attr` | 按属性和用户去重     |

### 4.3 profile\_filters 公共属性过滤（用户细分筛选）

用于按公共用户属性或公共事件属性对全局用户进行筛选，类似于对照组/细分筛选。

```json
"profile_filters": [
  {
    "show_name": "android用户",
    "show_label": "1",
    "expression": {
      "logic": "and",
      "expressions": [
        {
          "logic": "or",
          "conditions": [
            {
              "property_name": "os_name",
              "property_type": "common_param",
              "property_compose_type": "origin",
              "property_operation": "=",
              "property_values": ["android"]
            }
          ]
        }
      ]
    }
  }
]
```

### 4.4 filters 事件级过滤

写在每个 `query_unit` 的 `filters` 字段中，结构与 `profile_filters` 相同。

```json
"filters": [
  {
    "expression": {
      "logic": "and",
      "expressions": [
        {
          "logic": "or",
          "conditions": [
            {
              "property_name": "app_region",
              "property_type": "common_param",
              "property_compose_type": "origin",
              "property_operation": "=",
              "property_values": ["VN", "ID", "TH", "BR"]
            }
          ]
        }
      ]
    }
  }
]
```

### 4.5 condition 条件结构

```json
{
  "property_name": "os_name",
  "property_type": "common_param",
  "property_compose_type": "origin",
  "property_operation": "=",
  "property_values": ["android"]
}
```

| 字段                      | 说明     | 取值                                                                                                                  |
| ----------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| property\_name          | 属性名称   | 来自知识库中的属性 name 字段                                                                                                   |
| property\_type          | 属性类型   | `event_param`(事件属性) / `common_param`(公共事件属性) / `user_profile`(公共用户属性，profile\_filters中也可写作`profile`) / `cohort`(分群) |
| property\_compose\_type | 属性组合类型 | `origin`(普通属性) / `virtual`(虚拟属性)，默认\`origin\`                                                                       |
| property\_operation     | 比较操作符  | 见下方操作符说明表                                                                                                           |
| property\_values        | 属性值列表  | 字符串/数字数组，枚举可以从知识库的enums.md获取                                                                                        |

#### property\_operation 操作符说明

| 操作符                            | 说明                    | 适用类型       |
| ------------------------------ | --------------------- | ---------- |
| `=`                            | 等于                    | 所有类型       |
| `!=`                           | 不等于（string 类型时含 null） | 所有类型       |
| `not_equal_not_contain_null`   | 不等于且不含 null           | 所有类型       |
| `not_equal_contain_null`       | 不等于且含 null            | 所有类型       |
| `>`                            | 大于                    | 数字、version |
| `>=`                           | 大于等于                  | 数字、version |
| `<`                            | 小于                    | 数字、version |
| `<=`                           | 小于等于                  | 数字、version |
| `is_null`                      | 为空                    | 所有类型       |
| `is_not_null`                  | 不为空                   | 所有类型       |
| `in`                           | 包含于                   | 所有类型       |
| `not_in`                       | 不包含于                  | 所有类型       |
| `contain`                      | 字符串包含                 | string     |
| `not_contain`                  | 字符串不包含                | string     |
| `not_contain_not_contain_null` | 字符串不包含且不含 null        | string     |
| `custom_contain`               | 自定义包含                 | string     |
| `match`                        | 正则匹配                  | string     |
| `not_match`                    | 正则不匹配                 | string     |

### 4.6 groups\_v2 分组条件

分组条件可以写在 `query_unit` 的 `groups_v2` 中（事件属性 / 公共事件属性），也可以写在 `content.profile_groups_v2` 中（公共用户属性）。推荐使用 `groups_v2`。

```json
"groups_v2": [
  {
    "property_name": "country",
    "property_type": "profile",
    "property_compose_type": "origin"
  }
]
```

| property\_type             | 使用场景                                                | 属性来源（知识库）                                          |
| -------------------------- | --------------------------------------------------- | -------------------------------------------------- |
| `event_param`              | groups\_v2 / filters                                | `${CWD}/tea/{project_id}/events/{event_name}/{event_name}.md` 中 type=1 的属性 |
| `common_param`             | groups\_v2 / filters / profile\_filters             | `${CWD}/tea/{project_id}/any_event/any_event.md` 中 type=2 的属性              |
| `profile` 或 `user_profile` | groups\_v2 / profile\_groups\_v2 / profile\_filters | `${CWD}/tea/{project_id}/profile_params/profile_params.md` 中的属性            |

### 4.7 page 分页

```json
"page": {
  "limit": 200,
  "offset": 0
}
```

- `limit`：最大返回维度数据条数，默认 1000，最大 50000
- `offset`：目前未完全生效

### 4.8 option 查询选项

- 使用下列默认配置

```json
"option": {
  "chart_type": "line",
  "use_sample_data": false,
  "refresh_cache": false,
  "fusion": false,
  "insight": {},
  "analysis_subject": {},
  "accumulation": false,
  "is_pie": false,
  "skip_period_restrict": false,
  "ignored_by_au": false,
  "query_trigger_type": null,
  "query_trigger": "manual_query",
  "source": "finder"
}
```
当 `use_sample_data` 为 `true` 时，会使用样本数据进行查询，而不是真实数据，只在查询时间过长时用于探测查询是否正确。

## 5. 知识库属性映射到 DSL

### 5.1 属性类型映射

知识库中属性的 `type` 字段与 DSL `property_type` 的对应关系：

| 知识库来源文件                               | 知识库 type 值        | DSL property\_type         |
| ------------------------------------- | ----------------- | -------------------------- |
| `${CWD}/tea/{project_id}/events/{event_name}/{event_name}.md` | 1 (event\_param)  | `event_param`              |
| `${CWD}/tea/{project_id}/any_event/any_event.md`              | 2 (common\_param) | `common_param`             |
| `${CWD}/tea/{project_id}/profile_params/profile_params.md`    | —                 | `user_profile` 或 `profile` |

### 5.2 属性值类型映射

知识库中 `value_type` 对应 DSL 中 `property_values` 的格式：

| value\_type | 说明  | property\_values 示例  |
| ----------- | --- | -------------------- |
| string      | 字符串 | `["android", "ios"]` |
| int         | 整数  | `[1, 2]`             |
| float       | 浮点数 | `[1.5]`              |
| version     | 版本号 | `["41.0.3"]`         |

枚举值可参考知识库的`*enums.md`文件

## 6. Response 结构与理解

### 6.1 整体结构

```json
{
  "items": [
    {
      "trace_id": "878d48bfb59c4615b71454b9ee04ae34",
      "query_id": "a00:p00:c00:q01",
      "result_status": "SUCCESS",
      "execute_time": 0,
      "result_time": 1776156175633,
      "sub_error_info": { ... },
      "sub_error_code": 400044,
      "date_index_list": ["20260409", "20260410", "20260411", "20260412", "20260413"],
      "data_item_list": [ ... ]
    }
  ]
}
```

#### items 元素字段说明

| 字段                | 类型        | 说明                                                                         |
| ----------------- | --------- | -------------------------------------------------------------------------- |
| trace\_id         | string    | 链路追踪标识，用于问题排查                                                              |
| query\_id         | string    | 子查询标识，格式为 `a00:pXX:c00:qYY`，用于定位指标和 period                                 |
| result\_status    | string    | 子查询状态，`SUCCESS` 表示成功                                                       |
| execute\_time     | int       | 子查询执行时间（毫秒）                                                                |
| result\_time      | long      | 结果返回时间戳（毫秒）                                                                |
| sub\_error\_info  | object    | 部分区域查询失败时的错误信息，包含 `error_code`、`error_message`、`error_date_range`、`region` |
| sub\_error\_code  | int       | 子查询错误码                                                                     |
| date\_index\_list | string\[] | 数据时间索引，与 `data_item_list` 中每个 item 的 `data` 数组一一对应                         |
| data\_item\_list  | object\[] | 查询结果数据列表                                                                   |

### 6.2 data\_item\_list 元素结构

```json
{
  "item_key": "a00:p00:c00:q01:f00_168",
  "event_show_name": "launch_log",
  "show_name": "",
  "show_label": "B",
  "event_name": "launch_log",
  "event_type": "origin",
  "origin_group_by_key": "id",
  "group_by_key": "id",
  "group_by_type": "user_attr",
  "group_params": [
    {
      "property_name": "country",
      "property_type": "profile",
      "property_compose_type": "origin",
      "value": "id",
      "origin_value": "id"
    }
  ],
  "profile_params": { "country": "id" },
  "event_params": {},
  "common_params": {},
  "data": [104336240, 104948470, 105167860, 105166880, 0],
  "avg": 83923890,
  "sum": 419619450,
  "sum_value_square": 44020583758592500,
  "result_type": "event_users",
  "indicator_show_name": "总人数（UV）",
  "filter_label": "1",
  "filter_value": "android",
  "event_label": "B",
  "name": "B, id",
  "prefix_key": "B",
  "suffix_key": "id",
  "origin_key": "id",
  "contain_realtime": true,
  "extra": { "contain_realtime": true, "realtime_start_time": "20260413" },
  "metric_type": 0,
  "is_compute": false,
  "au_query": false,
  "virtual": false
}
```

#### data\_item 字段说明

| 字段                     | 类型        | 说明                                                  |
| ---------------------- | --------- | --------------------------------------------------- |
| item\_key              | string    | 数据项唯一标识，格式 `a00:p00:c00:qXX:fYY_ZZ`                 |
| event\_show\_name      | string    | 事件显示名                                               |
| show\_name             | string    | 查询显示名                                               |
| show\_label            | string    | 指标标识（A/B/C），对应 DSL 中 query\_unit 的 show\_label      |
| event\_name            | string    | 事件名称                                                |
| event\_type            | string    | 事件类型                                                |
| group\_by\_key         | string    | 分组 key 值，无分组时为 `__all`                              |
| origin\_group\_by\_key | string    | 原始分组 key                                            |
| group\_by\_type        | string    | 分组类型，如 `user_attr`                                  |
| group\_params          | object\[] | 分组参数详情，包含 `property_name`、`property_type`、`value` 等 |
| profile\_params        | object    | 命中的用户属性分组值，如 `{"country": "id"}`                    |
| event\_params          | object    | 命中的事件属性分组值                                          |
| common\_params         | object    | 命中的公共事件属性分组值                                        |
| data                   | number\[] | 指标数据数组，与上层 `date_index_list` 一一对应                   |
| avg                    | number    | 指标平均值                                               |
| sum                    | number    | 指标求和值                                               |
| sum\_value\_square     | number    | 指标平方和                                               |
| result\_type           | string    | 结果指标类型，如 `events`(总次数)、`event_users`(总人数)           |
| indicator\_show\_name  | string    | 指标显示名，如 "总人数（UV）"                                   |
| filter\_label          | string    | 对照组标识，对应 DSL 中 profile\_filters 的 show\_label       |
| filter\_value          | string    | 对照组名称，对应 DSL 中 profile\_filters 的 show\_name        |
| event\_label           | string    | 事件标识，同 show\_label                                  |
| name                   | string    | 结果项名称，格式为 `"{show_label}, {group_by_key}"`          |
| prefix\_key            | string    | 前缀 key，同 show\_label                                |
| suffix\_key            | string    | 后缀 key，同 group\_by\_key                             |
| origin\_key            | string    | 原始分组 key                                            |
| contain\_realtime      | bool      | 是否包含实时数据                                            |
| extra                  | object    | 扩展信息，`realtime_start_time` 标识实时数据起始日期               |
| metric\_type           | int       | 指标类型                                                |
| is\_compute            | bool      | 是否为组合计算指标                                           |
| au\_query              | bool      | 是否为活跃用户查询                                           |
| virtual                | bool      | 是否为虚拟事件                                             |

### 6.3 query\_id 规则

`query_id` 格式：`a00:pXX:c00:qYY`

- `pXX`：第 XX+1 个 period 的结果
- `qYY`：第 YY+1 个查询指标的结果

例如：第 2 个指标在第 1 个 period 下的结果 → `a00:p00:c00:q01`

### 6.4 data\_item\_list 数量规则

- **无分组情况下**：有 n 个对照组，就有 n 个 `data_item`，通过 `filter_label` 区分
- **无对照组情况下**：有 n 个分组，每个分组有 m 个分组 key 时，有 m×n 个 `data_item`，通过 `group_by_key` 区分
- **有分组有对照组**：有 n 个分组，每个分组有 m 个分组 key，且有 k 个对照组时，有 m×n×k 个 `data_item`

## 7. DSL 构建步骤

结合用户意图和知识库动态构建 DSL 的完整流程：

### Step 1：确定项目和资源

根据用户问题中的关键词，通过以下方式匹配目标项目：
- 用户指定项目
- 匹配 `${CWD}/tea/{project_id}/events/{event_name}/{event_name}.md` 中的事件 `name` 和 `description`，反向定位事件所属项目

确定项目后，将 `project_id` 填入 `resources`：

```json
"resources": [{ "project_ids": [55], "subject_ids": [1] }]
```

同时填入固定的顶层字段：

```json
{
  "version": 3,
  "use_app_cloud_id": true
}
```

### Step 2：确定时间范围

根据用户意图解析时间需求，统一使用 `past_range` 类型：

- **用户说"过去 N 天/周/月"** → 使用 `past` 类型的 spans

```json
"periods": [{
  "granularity": "day",
  "type": "past_range",
  "spans": [
    { "type": "past", "past": { "amount": 7, "unit": "day" } },
    { "type": "past", "past": { "amount": 1, "unit": "day" } }
  ],
  "timezone": "UTC",
  "week_start": 1,
  "align_unit": "day"
}]
```

- **用户指定具体日期范围** → 使用 `timestamp` 类型的 spans，时间戳为秒级

```json
"periods": [{
  "granularity": "day",
  "type": "past_range",
  "spans": [
    { "type": "timestamp", "timestamp": "1704729600" },
    { "type": "timestamp", "timestamp": "1705161599" }
  ],
  "timezone": "UTC",
  "week_start": 1,
  "align_unit": "day"
}]
```

- **用户需要汇总数据（不按日期拆分）** → `granularity` 设为 `all`
- **用户需要按天/周/月聚合** → `granularity` 设为 `day`/`week`/`month`

### Step 3：确定查询类型

根据用户意图选择 `query_type`：

| 用户意图                | query\_type  |
| ------------------- | ------------ |
| 查看某事件的 PV/UV/人均次数等  | `event`      |
| 查看用户留存率             | `retention`  |
| 查看漏斗转化率             | `funnel`     |
| 查看用户路径              | `path_find`  |
| 查看用户生命周期（新增/活跃/流失等） | `life_cycle` |

### Step 4：确定查询事件和指标

根据用户问题中的关键词，匹配知识库 `${CWD}/tea/{project_id}/events/{event_name}/{event_name}.md` 中的事件信息来确定目标事件：

- **event name**：事件名称（如 `launch_log`、`share_video`），用于精确匹配
- **show\_name**：事件显示名，用于中文描述匹配
- **description**：事件描述，用于语义匹配（如用户说"app调起"可匹配到 `launch_log` 的描述"app被调起上报"）

根据用户意图选择 `event_indicator`：

| 用户意图             | event\_indicator  | 是否需要 measure\_info                     |
| ---------------- | ----------------- | -------------------------------------- |
| 查看事件总次数（PV）      | `events`          | 否                                      |
| 查看事件总人数（UV）      | `event_users`     | 否                                      |
| 查看人均次数           | `events_per_user` | 否                                      |
| 查看渗透率            | `uv_per_au`       | 否                                      |
| 按某属性求和/平均/最大/最小等 | `measure`         | 是，需指定 `measure_type` 和 `property_name` |

构建 `queries` 二维数组，每个指标对应外层一个元素，`show_label` 按 A/B/C 递增：

```json
"queries": [
  [{
    "event_name": "app_launch",
    "event_type": "origin",
    "show_name": "应用启动",
    "show_label": "A",
    "event_indicator": "events",
    "measure_info": {},
    "groups_v2": [],
    "filters": []
  }],
  [{
    "event_name": "launch_log",
    "event_type": "origin",
    "show_name": "launch_log",
    "show_label": "B",
    "event_indicator": "event_users",
    "measure_info": {},
    "groups_v2": [],
    "filters": []
  }]
]
```

### Step 5：添加过滤条件

根据用户意图从知识库中查找属性，按属性来源决定放置位置和 `property_type`：

| 属性来源（知识库文件）                        | property\_type | 可放置位置                                           |
| ---------------------------------- | -------------- | ----------------------------------------------- |
| `${CWD}/tea/{project_id}/events/{name}/{name}.md` (type=1) | `event_param`  | `query_unit.filters` 或 `profile_filters`        |
| `${CWD}/tea/{project_id}/any_event/any_event.md` (type=2)  | `common_param` | `query_unit.filters` 或 `profile_filters`        |
| `${CWD}/tea/{project_id}/profile_params/profile_params.md` | `user_profile` | `profile_filters`（全局细分筛选）或 `query_unit.filters` |

- **全局过滤（对所有指标生效）** → 放在 `profile_filters` 中，常用于细分对照组
- **事件级过滤（仅对某个指标生效）** → 放在对应 `query_unit.filters` 中

属性值从知识库对应的 `_enums.md` 文件获取有效枚举值。

过滤条件结构支持嵌套的 `expressions`，外层 `logic` 控制多组条件间的关系（`and`/`or`），内层 `conditions` 为具体条件：

```json
"filters": [{
  "expression": {
    "logic": "and",
    "expressions": [{
      "logic": "or",
      "conditions": [{
        "property_name": "os_name",
        "property_type": "common_param",
        "property_compose_type": "origin",
        "property_operation": "=",
        "property_values": ["android"]
      }]
    }]
  }
}]
```

### Step 6：添加分组条件

根据用户意图从知识库中查找属性，填入 `groups_v2`：

| 属性来源            | property\_type | 放置位置                   |
| --------------- | -------------- | ---------------------- |
| 事件属性 (type=1)   | `event_param`  | `query_unit.groups_v2` |
| 公共事件属性 (type=2) | `common_param` | `query_unit.groups_v2` |
| 公共用户属性          | `profile`      | `query_unit.groups_v2` |

```json
"groups_v2": [{
  "property_name": "country",
  "property_type": "profile",
  "property_compose_type": "origin"
}]
```

如需多个指标按相同维度分组，需在每个 `query_unit` 中都添加相同的 `groups_v2`。

### Step 7：设置分页和选项

根据需要设置 `page.limit` 控制返回条数，以及 `content.option` 和顶层 `option`：

```json
"page": { "limit": 200, "offset": 0 },
"content.option": {
  "use_sample_data": false,
  "refresh_cache": false,
  "fusion": false
}
```

### 构建核对清单

- [ ] `version` 为 3，`use_app_cloud_id` 为 true
- [ ] `resources.project_ids` 与知识库 project\_id 一致
- [ ] `periods` 使用 `past_range` 类型，时区和粒度正确
- [ ] `query_type` 与用户分析意图匹配
- [ ] `queries` 中的 `event_name` 在知识库事件列表中存在
- [ ] `event_indicator` 与用户要查的指标匹配
- [ ] `filters` 中的 `property_name` 在知识库属性列表中存在，`property_type` 与来源匹配
- [ ] `property_values` 取值合法（参考 `_enums.md`）
- [ ] `groups_v2` 中的属性在知识库中存在且 `property_type` 正确
- [ ] 多指标查询时 `show_label` 按 A/B/C 递增且不重复

## 8. 常见 DSL 示例
> 可参考 dsl:`references/usages/examples/dsl.json` 及response:`references/usages/examples/dsl_result.json`

### 8.1 事件查询 — 基础查询

查询ROW过去 7 天 app\_launch 事件的总次数PV：

```json
{
  "version": 3,
  "use_app_cloud_id": true,
  "resources": [{ "project_ids": [55], "subject_ids": [1] }],
  "periods": [{
    "granularity": "day",
    "align_unit": "day",
    "type": "past_range",
    "spans": [
      { "type": "past", "past": { "amount": 7, "unit": "day" } },
      { "type": "past", "past": { "amount": 1, "unit": "day" } }
    ],
    "timezone": "UTC",
    "week_start": 1
  }],
  "content": {
    "query_type": "event",
    "profile_groups_v2": [],
    "profile_filters": [],
    "orders": [],
    "queries": [[{
      "event_name": "app_launch",
      "event_type": "origin",
      "show_name": "应用启动",
      "show_label": "A",
      "event_indicator": "events",
      "measure_info": {},
      "groups_v2": [],
      "filters": []
    }]],
    "page": { "offset": 0, "limit": 200 },
    "option": {"chart_type": "line","use_sample_data": false,"refresh_cache": false,"fusion": false,"insight": {},"analysis_subject": {},"accumulation": false,"is_pie": false,"skip_period_restrict": false,"ignored_by_au": false,"query_trigger_type": null,"query_trigger": "manual_query","source": "finder"}
  },
  "option": {
    "blend": {"status": true,"base": 0,"base_period": true},
    "transpose": false,
    "finder": {"sort_rule": "avg_desc"},
    "region_filter": ["ROW"]
  }
}
```

### 8.2 事件查询 — 多指标 + 过滤 + 分组

查询GLOBAL过去 5 天 Android 端 app\_launch 总次数PV（按 app\_region 过滤）和 launch\_log 总人数UV（按 app\_version 过滤），均按 country 分组：

```json
{
  "use_app_cloud_id": true,
  "periods": [{
    "granularity": "day",
    "align_unit": "day",
    "timezone": "UTC",
    "week_start": 1,
    "type": "past_range",
    "spans": [
      { "type": "past", "past": { "amount": 5, "unit": "day" } },
      { "type": "past", "past": { "amount": 1, "unit": "day" } }
    ]
  }],
  "version": 3,
  "content": {
    "profile_groups_v2": [],
    "profile_filters": [{
      "expression": {
        "logic": "and",
        "expressions": [{
          "logic": "or",
          "conditions": [{
            "property_type": "common_param",
            "property_name": "os_name",
            "property_compose_type": "origin",
            "property_operation": "=",
            "property_values": ["android"]
          }]
        }]
      },
      "show_name": "android",
      "show_label": "1"
    }],
    "orders": [],
    "query_type": "event",
    "queries": [
      [{
        "event_indicator": "events",
        "show_name": "应用启动",
        "show_label": "A",
        "event_name": "app_launch",
        "event_type": "origin",
        "measure_info": {},
        "filters": [{
          "expression": {
            "logic": "and",
            "expressions": [{
              "logic": "or",
              "conditions": [{
                "property_type": "common_param",
                "property_name": "app_region",
                "property_compose_type": "origin",
                "property_operation": "=",
                "property_values": ["VN", "ID", "TH", "BR"]
              }]
            }]
          }
        }],
        "groups_v2": [{
          "property_compose_type": "origin",
          "property_name": "country",
          "property_type": "profile"
        }]
      }],
      [{
        "event_indicator": "event_users",
        "show_name": "launch_log UV",
        "show_label": "B",
        "event_name": "launch_log",
        "event_type": "origin",
        "measure_info": {},
        "filters": [{
          "expression": {
            "logic": "and",
            "expressions": [{
              "logic": "or",
              "conditions": [{
                "property_type": "common_param",
                "property_name": "app_version",
                "property_compose_type": "origin",
                "property_operation": ">=",
                "property_values": ["41.0.3"]
              }]
            }]
          }
        }],
        "groups_v2": [{
          "property_compose_type": "origin",
          "property_name": "country",
          "property_type": "profile"
        }]
      }]
    ],
    "page": { "offset": 0, "limit": 200 },
    "option": {"chart_type": "line","use_sample_data": false,"refresh_cache": false,"fusion": false,"insight": {},"analysis_subject": {},"accumulation": false,"is_pie": false,"skip_period_restrict": false,"ignored_by_au": false,"query_trigger_type": null,"query_trigger": "manual_query","source": "finder"}
  },
  "resources": [{ "project_ids": [55], "subject_ids": [1] }],
  "option": {
    "blend": {"status": true,"base": 0,"base_period": true},
    "transpose": false,
    "finder": {"sort_rule": "avg_desc"},
    "region_filter": ["GLOBAL"]
  }
}
```

### 8.3 自定义计算指标（measure）

查询 purchase 事件按 currency\_amount 属性求和：

```json
{
  "event_name": "purchase",
  "event_type": "origin",
  "show_label": "A",
  "event_indicator": "measure",
  "measure_info": {
    "measure_type": "sum",
    "property_name": "currency_amount"
  },
  "groups_v2": [],
  "filters": []
}
```

## 9. 注意事项

1. **project\_id**：必须使用 TEA 主站 path 上的 project\_id（如 TikTok 为 55），不是字节应用云 ID
2. **periods.type**：推荐统一使用 `past_range`，其他类型不保证接口正确性
3. **property\_type 区分**：
   - `profile_filters` 中只能使用 `user_profile`(或 `profile`)、`common_param`、`event_param`
   - `query_unit.filters` 和 `groups_v2` 中可以使用 `event_param`、`common_param`、`user_profile`(或 `profile`)
4. **属性枚举值**：构建 `property_values` 时，参考知识库中对应的 `_enums.md` 文件获取有效枚举值
5. **limit 设置**：`page.limit` 设置过大可能导致查询超时，建议根据实际需要合理设置
6. **多指标查询**：`queries` 外层每个元素对应一个独立的查询指标，Response 中通过 `query_id` 的 `qXX` 部分对应
7. **对照组**：`profile_filters` 中的每个元素代表一个对照组，Response 中通过 `filter_label` 区分
8. **分组**：分组后 Response 的 `data_item_list` 会按分组值展开，通过 `group_by_key` 区分

## 10. 查询&结果分析

### 10.1 查询执行

```bash
bytedcli tea query --dsl '{dsl_json}' --region {region}
```

**环境变量**：优先使用 `TEA_APP_ID` 和 `TEA_APP_SECRET` 环境变量，也可通过 `--app-id` / `--app-secret` 参数传入。

**错误处理**：
- 查询失败时检查 `result_status`

### 10.2 结果分析
将查询结果整理为用户友好的格式：

1. **数据表格**：按 `date_index_list` 和 `data_item_list` 构建 Markdown 表格
   - 行：时间维度或分组维度
   - 列：各指标值
   - 通过 `query_id` 的 `qXX` 定位指标，`pXX` 定位 period
   - 通过 `filter_label` 区分对照组，`group_by_key` 区分分组

2. **数据摘要**：提供关键指标的汇总统计（avg、sum）

3. **趋势分析**：如有时间序列数据，简要描述趋势变化

4. **页面链接**：附上 TEA 页面链接，方便用户在 TEA 平台查看详情

```bash
bytedcli tea dsl2link --dsl '{dsl_json}' --region {region}
```