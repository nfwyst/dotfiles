# Datalive 直播管理命令速查

## 命令列表

### `bytedcli datalive live-room list`

搜索主播并查询直播记录。

**用法**：
```bash
bytedcli datalive live-room list [options]
```

**选项**：

| 选项 | 描述 | 默认值 | 必需 |
|------|------|--------|------|
| `--keyword <keyword>` | 搜索关键词（主播昵称） | - | 是 |
| `--page <page>` | 页码 | 1 | 否 |
| `--page-size <size>` | 每页大小 | 20 | 否 |

**示例**：

```bash
# 检查登录状态
bytedcli auth status

# 如果未登录，执行登录
bytedcli auth login

# 搜索关键词为"主播"的主播
bytedcli datalive live-room list --keyword "主播"

# 自定义每页大小
bytedcli datalive live-room list --keyword "主播" --page-size 50

# 以 JSON 格式输出
bytedcli --json datalive live-room list --keyword "主播"

# 获取直播间详细信息
bytedcli datalive live-room get --room-id "example-room-id-123456"

# 获取直播间成交情况
bytedcli datalive live-room key-index --room-id "example-room-id-123456"

# 以 JSON 格式输出成交情况
bytedcli --json datalive live-room key-index --room-id "example-room-id-123456"

# 获取直播间分钟级趋势数据
bytedcli datalive live-room room-minute-indicator --room-id "example-room-id-123456" --fields "pay_order_gmv_minute_trend,pay_order_cnt_minute_trend"

# 以 JSON 格式输出分钟级趋势数据
bytedcli --json datalive live-room room-minute-indicator --room-id "example-room-id-123456" --fields "pay_order_gmv_minute_trend,pay_order_cnt_minute_trend"

# 搜索直播间并获取详细信息（完整流程）
# 1. 搜索直播间
bytedcli datalive live-room list --keyword "示例主播" --page-size 10
# 2. 让用户从搜索结果中选择一个直播间 ID
# 3. 获取直播间详细信息
bytedcli datalive live-room get --room-id "example-room-id-123456"
# 4. 获取直播间成交情况
bytedcli datalive live-room key-index --room-id "example-room-id-123456"
# 5. 获取直播间转化漏斗数据
bytedcli datalive live-room conversion-funnel --room-id "example-room-id-123456"
# 6. 获取直播间用户画像数据
bytedcli datalive live-room portrait --room-id "example-room-id-123456"
# 7. 获取直播间流量来源数据
bytedcli datalive live-room flow --room-id "example-room-id-123456"
# 8. 获取直播间关注商品数据
bytedcli datalive live-room follow-product --room-id "example-room-id-123456"
# 9. 获取直播间分钟级趋势数据
bytedcli datalive live-room room-minute-indicator --room-id "example-room-id-123456" --fields "pay_order_gmv_minute_trend,pay_order_cnt_minute_trend"
```

**输出说明**：

- 文本输出：显示主播列表和每个主播的直播记录
- JSON 输出：返回完整的主播信息和直播记录数据

**返回数据结构**：

```json
{
  "status": "success",
  "data": {
    "room_id": "example-room-id-123456",
    "room_info": {
      "user_id": 1234567890123456,
      "user_id_str": "1234567890123456",
      "nickname": "示例主播",
      "create_time": 1712345678,
      "start_time": 1712345689,
      "finish_time": 1712432101,
      "rt_mp_pull_url": "https://example.com/stream?room_id=example-room-id-123456",
      "cover": "https://example.com/cover-image.jpeg",
      "is_live": false,
      "duration": 86412,
      "type": "m3u8",
      "play_back_url": "https://example.com/playback/playlist.m3u8",
      "v_codec": "bytevc1",
      "contain_cart": true,
      "current_product_id": 987654,
      "has_current_coupon": true,
      "has_seckill": true,
      "qr_code": "",
      "title": "示例直播间标题",
      "is_life": true,
      "is_life_snowflake": false,
      "is_life_house": true,
      "live_duration": 86412,
      "stream_id": "stream-example-123456",
      "is_roi2_room": false,
      "is_life_merchant": true
    }
  },
  "error": null,
  "context": {
    "execution_time_ms": 250,
    "timestamp": "2026-04-14T12:00:00"
  }
}
```

### `bytedcli datalive live-room info`

获取直播间详细信息。

**用法**：
```bash
bytedcli datalive live-room info [options]
```

**选项**：

| 选项 | 描述 | 默认值 | 必需 |
|------|------|--------|------|
| `--room-id <id>` | 直播间 ID | - | 是 |

### `bytedcli datalive live-room key-index`

获取直播间成交情况数据。

**用法**：
```bash
bytedcli datalive live-room key-index [options]
```

**选项**：

| 选项 | 描述 | 默认值 | 必需 |
|------|------|--------|------|
| `--room-id <id>` | 直播间 ID | - | 是 |

### `bytedcli datalive live-room info`

获取直播间详细信息。

**用法**：
```bash
bytedcli datalive live-room info [options]
```

**选项**：

| 选项 | 描述 | 默认值 | 必需 |
|------|------|--------|------|
| `--room-id <id>` | 直播间 ID | - | 是 |

### `bytedcli datalive live-room key-index`

获取直播间成交情况数据。

**用法**：
```bash
bytedcli datalive live-room key-index [options]
```

**选项**：

| 选项 | 描述 | 默认值 | 必需 |
|------|------|--------|------|
| `--room-id <id>` | 直播间 ID | - | 是 |

### `bytedcli datalive live-room conversion-funnel`

获取直播间转化漏斗数据。

**用法**：
```bash
bytedcli datalive live-room conversion-funnel [options]
```

**选项**：

| 选项 | 描述 | 默认值 | 必需 |
|------|------|--------|------|
| `--room-id <id>` | 直播间 ID | - | 是 |

### `bytedcli datalive live-room portrait`

获取直播间用户画像数据。

**用法**：
```bash
bytedcli datalive live-room portrait [options]
```

**选项**：

| 选项 | 描述 | 默认值 | 必需 |
|------|------|--------|------|
| `--room-id <id>` | 直播间 ID | - | 是 |

### `bytedcli datalive live-room flow`

获取直播间流量来源数据。

**用法**：
```bash
bytedcli datalive live-room flow [options]
```

**选项**：

| 选项 | 描述 | 默认值 | 必需 |
|------|------|--------|------|
| `--room-id <id>` | 直播间 ID | - | 是 |

### `bytedcli datalive live-room follow-product`

获取直播间关注商品数据。

**用法**：
```bash
bytedcli datalive live-room follow-product [options]
```

**选项**：

| 选项 | 描述 | 默认值 | 必需 |
|------|------|--------|------|
| `--room-id <id>` | 直播间 ID | - | 是 |
| `--minute <minute>` | 分钟数 | - | 否 |

### `bytedcli datalive live-room room-minute-indicator`

获取直播间分钟级趋势数据。

**用法**：
```bash
bytedcli datalive live-room room-minute-indicator [options]
```

**选项**：

| 选项 | 描述 | 默认值 | 必需 |
|------|------|--------|------|
| `--room-id <id>` | 直播间 ID | - | 是 |
| `--fields <fields>` | 逗号分隔的字段列表，例如："pay_order_gmv_minute_trend,pay_order_cnt_minute_trend" | - | 是 |
| `--size <size>` | 分钟级点数量 | - | 否 |

## 登录问题解决

Datalive API 需要登录才能访问。当执行命令遇到未登录错误（`authenticated: false`）时，会自动执行登录命令：

```bash
# 自动执行登录
bytedcli auth login

# 登录后自动重新执行原命令
bytedcli datalive live-room list --keyword "主播"
```

**站点切换**：
如果需要访问不同站点的 Datalive，请使用 `--site` 参数：
```bash
# 切换到 cn 站点并自动登录
bytedcli --site cn auth login
bytedcli --site cn datalive live-room list --keyword "主播"
```

## 常见问题

### Q: 为什么返回的直播记录为空？
A: 可能是因为该主播近期没有直播记录，或者 API 没有返回相关数据。

### Q: 为什么搜索结果与预期不符？
A: 请检查关键词是否正确，API 可能会对关键词进行模糊匹配。

### Q: 如何获取更多直播记录？
A: 目前 API 只返回部分直播记录，无法获取全部历史记录。

### Q: 如何搜索直播间并获取详细信息？
A: 可以按照以下流程操作：
1. 检查登录状态：`bytedcli auth status`
2. 如果未登录，执行登录：`bytedcli auth login`
3. 搜索直播间获取列表：`bytedcli datalive live-room list --keyword "关键词" --page-size 10`
4. 从搜索结果中选择一个直播间，记录其 room_id
5. **只有在用户选定直播间 ID 后**，才执行以下操作：
   - 获取选定直播间的详细信息：`bytedcli datalive live-room info --room-id "选定的room_id"`
   - 获取直播间成交情况：`bytedcli datalive live-room key-index --room-id "选定的room_id"`
   - 获取直播间转化漏斗数据：`bytedcli datalive live-room conversion-funnel --room-id "选定的room_id"`
   - 获取直播间用户画像数据：`bytedcli datalive live-room portrait --room-id "选定的room_id"`
   - 获取直播间流量来源数据：`bytedcli datalive live-room flow --room-id "选定的room_id"`
   - 获取直播间关注商品数据：`bytedcli datalive live-room follow-product --room-id "选定的room_id"`
   - 获取直播间分钟级趋势数据：`bytedcli datalive live-room room-minute-indicator --room-id "选定的room_id" --fields "pay_order_gmv_minute_trend,pay_order_cnt_minute_trend"`
6. **未选定直播间 ID 前**，不执行任何直播间详情查询操作

---

## 完整使用示例

### 示例 1：搜索主播

- 用户输入："搜索主播张三"
- 提取 keyword："张三"
- 执行命令：
  ```bash
  bytedcli auth status
  bytedcli auth login
  bytedcli datalive live-room list --keyword "张三"
  ```

### 示例 2：查询直播记录

- 用户输入："查询主播李四的直播记录"
- 提取 keyword："李四"
- 执行命令：
  ```bash
  bytedcli auth status
  bytedcli auth login
  bytedcli datalive live-room list --keyword "李四"
  ```

### 示例 3：查询直播间成交情况

- 用户输入："查询直播间 example-room-id-123456 的成交情况"
- 提取 room_id："example-room-id-123456"
- 执行命令：
  ```bash
  bytedcli auth status
  bytedcli auth login
  bytedcli datalive live-room key-index --room-id "example-room-id-123456"
  ```

### 示例 4：查询直播间交易趋势

- 用户输入："查询直播间 example-room-id-123456 的交易趋势"
- 提取 room_id："example-room-id-123456"
- 提取 fields："pay_order_gmv_minute_trend,pay_order_cnt_minute_trend"
- 执行命令：
  ```bash
  bytedcli auth status
  bytedcli auth login
  bytedcli datalive live-room room-minute-indicator --room-id "example-room-id-123456" --fields "pay_order_gmv_minute_trend,pay_order_cnt_minute_trend"
  ```

### 示例 5：完整的直播间分析流程

- 用户输入："查询示例主播的直播间信息"
- 提取 keyword："示例主播"
- 执行命令：
  ```bash
  bytedcli auth status
  bytedcli auth login
  # 搜索直播间
  bytedcli datalive live-room list --keyword "示例主播" --page-size 10
  # 让用户从搜索结果中选择一个直播间 ID
  # 假设用户选择的 room_id 为 example-room-id-123456
  # 获取直播间详细信息
  bytedcli datalive live-room get --room-id "example-room-id-123456"
  # 获取直播间成交情况
  bytedcli datalive live-room key-index --room-id "example-room-id-123456"
  # 获取直播间转化漏斗数据
  bytedcli datalive live-room conversion-funnel --room-id "example-room-id-123456"
  # 获取直播间用户画像数据
  bytedcli datalive live-room portrait --room-id "example-room-id-123456"
  # 获取直播间流量来源数据
  bytedcli datalive live-room flow --room-id "example-room-id-123456"
  # 获取直播间关注商品数据
  bytedcli datalive live-room follow-product --room-id "example-room-id-123456"
  # 获取直播间分钟级趋势数据
  bytedcli datalive live-room room-minute-indicator --room-id "example-room-id-123456" --fields "pay_order_gmv_minute_trend,pay_order_cnt_minute_trend"
  ```

---

## 数据展示格式规范

### 基本原则

- 所有数据都应以结构化、表格化的形式展示
- 确保数据排序合理，突出重要信息
- 避免使用简单的列表形式，采用更结构化的表格展示
- 分钟级趋势应展示关键统计信息，而不是生成文件

### 数据获取方式

Skill 应使用以下方式获取和展示数据：

1. **使用 JSON 输出**：
   - 使用 `--json` 参数执行 CLI 命令
   - Skill 解析 JSON 数据并按照结构化格式进行展示
   - 优点：可以获得结构化数据，便于灵活展示

2. **具体实现逻辑**：
   - **搜索直播间列表**：使用 `bytedcli --json datalive live-room list --keyword "{user_keyword}" --page-size 10` 获取结构化数据
   - **用户画像**：使用 `bytedcli --json datalive live-room portrait --room-id "{selected_room_id}"` 获取 JSON 数据
   - **流量来源**：使用 `bytedcli --json datalive live-room flow --room-id "{selected_room_id}"` 获取 JSON 数据
   - **转化漏斗**：使用 `bytedcli --json datalive live-room conversion-funnel --room-id "{selected_room_id}"` 获取 JSON 数据
   - **关注商品**：使用 `bytedcli --json datalive live-room follow-product --room-id "{selected_room_id}"` 获取 JSON 数据
   - **分钟级趋势**：使用 `bytedcli --json datalive live-room room-minute-indicator --room-id "{selected_room_id}" --fields "pay_order_gmv_minute_trend,pay_order_cnt_minute_trend"` 获取 JSON 数据

### JSON 数据解析和展示逻辑

#### 1. 用户画像

- 从 `data.watch_data` 和 `data.order_data` 中提取数据
- **年龄分布**：按年龄段排序，显示占比和人数
- **性别分布**：按占比降序排序，显示占比和人数
- **粉丝分布**：按占比降序排序，显示占比和人数
- **省份分布**：按人数降序排序，显示前10个
- **城市分布**：按人数降序排序，显示前10个

#### 2. 流量来源

- 从 `data.watch_data.flow_type` 和 `data.order_data.flow_type` 中提取数据
- 显示自然流量和商业流量的整体结构
- 按人数降序排序显示自然流量细分和商业流量细分

#### 3. 转化漏斗

- 从 `data.data.funnel` 中提取数据
- 区分人数值和转化率值
- 以三列表格形式展示：漏斗环节、人数、转化率
- 计算相邻环节的转化率

#### 4. 分钟级趋势

- 从 `data.data` 中提取趋势数据
- 计算统计信息：最大值、最小值、平均值、数据点数量
- 展示部分关键数据点，避免输出过多
- 不要生成 txt 文件，直接在界面上展示

---

## 展示示例

### 成交自然流量细分

```
📊 自然流量:
  ==========================================================================================
  总人数: 15,678 (42.8%)

  详细来源:
  ------------------------------------------------------------------------------------------
  来源          |  人数      |  占比
  --------------|------------|----------
  推荐路径      |   3,421    | 21.8%
  搜索          |   2,890    | 18.4%
  其他          |   1,987    | 12.7%
  POI直播入口   |     523    | 3.3%
  ------------------------------------------------------------------------------------------

  🔍 自然流量细分:
  ------------------------------------------------------------------------------------------
  来源          |  占比
  --------------|----------
  推荐路径      | 21.8%
  搜索          | 18.4%
  其他          | 12.7%
  POI直播入口   | 3.3%
  ------------------------------------------------------------------------------------------
```

### 人群画像

```
👁️  观看用户画像:
------------------------------------------------------------------------------------------
==========================================================================================

🎯 年龄分布:
------------------------------------------------------------------------------------------
  年龄段    |  占比      |  人数
  ----------|------------|----------
  24-30     | 35.62%     |      3,562
  31-40     | 28.45%     |      2,845
  18-23     | 18.78%     |      1,878
  41-50     | 12.34%     |      1,234
  50+       | 4.81%      |        481
------------------------------------------------------------------------------------------
  总计      |  100%      |     10,000

👥 性别分布:
------------------------------------------------------------------------------------------
  性别      |  占比      |  人数
  ----------|------------|----------
  女        | 62.89%     |      6,289
  男        | 36.78%     |      3,678
  未知      | 0.33%      |         33
------------------------------------------------------------------------------------------
  总计      |  100%      |     10,000

⭐ 粉丝分布:
------------------------------------------------------------------------------------------
  类型      |  占比      |  人数
  ----------|------------|----------
  非粉丝    | 85.67%     |      8,567
  粉丝      | 14.33%     |      1,433
------------------------------------------------------------------------------------------
  总计      |  100%      |     10,000

🌍 地域特征 (省份分布 - Top 10):
------------------------------------------------------------------------------------------
  排名 | 省份      |  占比      |  人数
  ----|----------|------------|----------
     1 | 浙江      | 11.23%     |      1,123
     2 | 四川      | 10.56%     |      1,056
     3 | 湖南      | 9.78%      |        978
     4 | 湖北      | 8.45%      |        845
     5 | 安徽      | 7.23%      |        723
------------------------------------------------------------------------------------------
  总计 |          |  100%      |     10,000
  前10 |          | 47.25%     |      4,725

🌆 城市分布 (Top 10):
------------------------------------------------------------------------------------------
  排名 | 城市      |  占比      |  人数
  ----|----------|------------|----------
     1 | 杭州      | 8.78%      |        878
     2 | 长沙      | 7.12%      |        712
     3 | 武汉      | 5.89%      |        589
     4 | 宁波      | 4.78%      |        478
     5 | 合肥      | 4.23%      |        423
     6 | 南京      | 3.98%      |        398
     7 | 温州      | 3.45%      |        345
     8 | 无锡      | 3.12%      |        312
     9 | 常州      | 2.87%      |        287
    10 | 南昌      | 2.65%      |        265
------------------------------------------------------------------------------------------
  总计 |          |  100%      |     10,000
  前10 |          | 46.87%     |      4,687
==========================================================================================

💳 交易用户画像:
------------------------------------------------------------------------------------------
==========================================================================================

🎯 年龄分布:
------------------------------------------------------------------------------------------
  年龄段    |  占比      |  人数
  ----------|------------|----------
  24-30     | 38.56%     |      3,856
  31-40     | 31.23%     |      3,123
  41-50     | 16.78%     |      1,678
  18-23     | 9.45%      |        945
  50+       | 3.98%      |        398
------------------------------------------------------------------------------------------
  总计      |  100%      |     10,000

👥 性别分布:
------------------------------------------------------------------------------------------
  性别      |  占比      |  人数
  ----------|------------|----------
  女        | 68.23%     |      6,823
  男        | 31.45%     |      3,145
  未知      | 0.32%      |         32
------------------------------------------------------------------------------------------
  总计      |  100%      |     10,000

⭐ 粉丝分布:
------------------------------------------------------------------------------------------
  类型      |  占比      |  人数
  ----------|------------|----------
  非粉丝    | 82.34%     |      8,234
  粉丝      | 17.66%     |      1,766
------------------------------------------------------------------------------------------
  总计      |  100%      |     10,000

🌍 地域特征 (省份分布 - Top 10):
------------------------------------------------------------------------------------------
  排名 | 省份      |  占比      |  人数
  ----|----------|------------|----------
     1 | 浙江      | 15.12%     |      1,512
     2 | 湖南      | 12.45%     |      1,245
     3 | 四川      | 10.78%     |      1,078
     4 | 湖北      | 9.34%      |        934
     5 | 安徽      | 7.89%      |        789
------------------------------------------------------------------------------------------
  总计 |          |  100%      |     10,000
  前10 |          | 55.58%     |      5,558

🌆 城市分布 (Top 10):
------------------------------------------------------------------------------------------
  排名 | 城市      |  占比      |  人数
  ----|----------|------------|----------
     1 | 杭州      | 8.78%      |        878
     2 | 长沙      | 7.12%      |        712
     3 | 武汉      | 5.89%      |        589
     4 | 宁波      | 4.78%      |        478
     5 | 合肥      | 4.23%      |        423
     6 | 南京      | 3.98%      |        398
     7 | 温州      | 3.45%      |        345
     8 | 无锡      | 3.12%      |        312
     9 | 常州      | 2.87%      |        287
    10 | 南昌      | 2.65%      |        265
------------------------------------------------------------------------------------------
  总计 |          |  100%      |     10,000
  前10 |          | 44.87%     |      4,487
==========================================================================================
```

### 转化漏斗

```
📊 转化分析数据 - Room ID: example-room-id-123456
====================================================================================================
  转化漏斗:
  ==========================================================================================
  漏斗环节          |  人数      |  转化率
  ------------------|------------|----------
  直播曝光人数        |    156,780 |          -
  ------------------------------------------------------------------------------------------
  直播看播人数        |     42,345 |    27.01%
  ------------------------------------------------------------------------------------------
  商品曝光人数        |     34,567 |    81.63%
  ------------------------------------------------------------------------------------------
  商品点击人数        |        987 |     2.86%
  ------------------------------------------------------------------------------------------
  成交人数           |        189 |    19.15%
  ==========================================================================================
```