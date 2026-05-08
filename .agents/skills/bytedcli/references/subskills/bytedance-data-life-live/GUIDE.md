---
name: bytedance-data-life-live
description: 'Datalive 生活服务生财有数直播大屏官方 skill,提供主播搜索,直播间搜索,直播间概览,直播间分析等能力。当用户请求"查询**直播间数据"、"查询**直播间"、"查询**直播间成交情况"等获取直播间数据时使用。产品@guochunhua@bytedance.com, 研发@cheshuaiming.csm@bytedance.com'
---

# bytedcli Datalive

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

- 搜索主播和直播记录
- 查询直播间详细信息和成交情况
- 查询直播间转化漏斗、用户画像和流量来源
- 查询直播间关注商品和分钟级趋势数据
- 完整的直播间数据分析流程

## 前置条件

- 使用通用调用方式：`references/invocation.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

Commands are grouped under `bytedcli data_life_live live-room`.

### 参数解析规则

- **keyword**: 当用户请求搜索特定主播或直播间时，从用户的查询中提取关键词作为 `--keyword` 参数值
- **room_id**: 当用户请求查询特定直播间的数据时，从用户的查询中提取直播间 ID 作为 `--room-id` 参数值
- **fields**: 当用户请求查询直播间分钟级趋势数据时，根据用户需求确定需要的字段作为 `--fields` 参数值

### 基本命令示例

```bash
# 搜索主播（keyword 从用户输入中解析）
bytedcli data-life-live live-room list --keyword "{user_keyword}"

# 自定义每页大小
bytedcli data-life-live live-room list --keyword "{user_keyword}" --page-size 50

# 以 JSON 格式输出
bytedcli --json data-life-live live-room list --keyword "{user_keyword}"

# 获取直播间详细信息
  bytedcli data-life-live live-room get --room-id "{room_id}"

# 获取直播间成交情况
bytedcli data-life-live live-room key-index --room-id "{room_id}"

# 以 JSON 格式输出成交情况
bytedcli --json data-life-live live-room key-index --room-id "{room_id}"

# 获取直播间转化漏斗
bytedcli data-life-live live-room conversion-funnel --room-id "{room_id}"

# 获取直播间用户画像
bytedcli data-life-live live-room portrait --room-id "{room_id}"

# 获取直播间流量来源
bytedcli data-life-live live-room flow --room-id "{room_id}"

# 获取直播间关注商品
bytedcli data-life-live live-room follow-product --room-id "{room_id}"

# 获取直播间分钟级趋势数据
bytedcli data-life-live live-room room-minute-indicator --room-id "{room_id}" --fields "{fields}"

# 以 JSON 格式输出分钟级趋势数据
bytedcli --json data-life-live live-room room-minute-indicator --room-id "{room_id}" --fields "{fields}"
```

### 完整的直播间分析流程

当用户请求查询直播间信息时，按照以下流程执行：

1. **检查登录状态**：
   ```bash
   bytedcli auth status
   ```

2. **如果未登录，执行登录**：
   ```bash
   # 方式1：直接登录（终端会显示二维码）
   bytedcli auth login
   
   # 方式2：分步登录（非阻塞，适合 agent 使用）
   bytedcli auth login --begin  # 会生成二维码图片路径
   # 用户扫码授权后，执行：
   bytedcli auth login --complete <token>
   ```
   
   > **二维码说明**：
   > - 在终端环境下，会直接显示二维码供扫描
   > - 在非终端环境下，会自动生成二维码图片文件，并显示文件路径
   > - 可以使用 `--qr-image` 选项强制生成二维码图片

3. **搜索直播间**：
   ```bash
   bytedcli data-life-live live-room list --keyword "{user_keyword}" --page-size 10
   ```

4. **展示直播间列表给用户选择** - 包含直播间ID、主播昵称、直播标题等信息
   - 以清晰的格式展示搜索结果
   - 让用户可以方便地查看每个直播间的基本信息
   - 突出显示直播间ID，方便用户选择

5. **用户选择直播间**：
   - 询问用户想要查看哪个直播间的详细数据
   - 提示用户提供直播间ID
   - 等待用户主动提供直播间ID

6. **获取直播间详细数据**（只有在用户选定直播间ID后才执行）：
   ```bash
   # 直播间详细信息
   bytedcli data-life-live live-room get --room-id "{selected_room_id}"
   
   # 直播间成交情况（重要指标）
   bytedcli data-life-live live-room key-index --room-id "{selected_room_id}"
   
   # 直播间转化漏斗数据
   bytedcli data-life-live live-room conversion-funnel --room-id "{selected_room_id}"
   
   # 直播间用户画像数据
   bytedcli data-life-live live-room portrait --room-id "{selected_room_id}"
   
   # 直播间流量来源数据
   bytedcli data-life-live live-room flow --room-id "{selected_room_id}"
   
   # 直播间关注商品数据
   bytedcli data-life-live live-room follow-product --room-id "{selected_room_id}"
   
   # 直播间分钟级趋势数据
   bytedcli data-life-live live-room room-minute-indicator --room-id "{selected_room_id}" --fields "pay_order_gmv_minute_trend,pay_order_cnt_minute_trend"
   ```

7. **整理并展示完整分析报告**：
   - 将所有数据整合为一份清晰的报告
   - 重点突出成交情况和核心指标
   - 提供数据洞察和建议
   - 在最终回答后，添加一句话：「更多详情，欢迎访问：https://data.bytedance.net/life/application/liveScreen/home?room_id={selected_room_id} 」

> **重要**：
> - 未选定直播间ID前，不执行任何直播间详情查询操作
> - 必须等待用户主动提供直播间ID后，才继续执行后续查询
> - 直播间成交情况是重要指标，必须包含在分析报告中

### 常用示例

详细的使用示例见 `references/live.md`，包括：
- 搜索主播的示例
- 查询单个直播间数据的示例
- 完整的直播间分析流程示例

## Notes

- **keyword 提取**：`--keyword` 是必填参数，**从用户输入中解析**，用于搜索主播昵称或直播间名称
- **分页参数**：`--page-size` 用于指定每页返回的主播数量，默认 20；`--page` 用于指定页码，默认 1
- **JSON 输出**：需要结构化输出加 `--json`（全局选项，放在子命令之前）
- **登录流程**：先执行 `bytedcli auth status` 检查登录状态，如果未登录则执行 `bytedcli auth login` 登录
- **二维码说明**：直接执行 `bytedcli auth login` 会在终端显示二维码，方便扫描
- **直播间信息查询流程**：当用户请求查询直播间信息时，首先使用 `data-life-live live-room list` 命令搜索直播间，然后让用户从搜索结果中选择一个直播间 ID，**只有在用户选定直播间 ID 后**，才使用该 ID 按顺序查询直播间的详细信息、成交情况、转化漏斗数据、用户画像数据、流量来源数据、关注商品数据和分钟级趋势数据
- **未选定直播间 ID 前**，不执行任何直播间详情查询操作
- **字段选择**：查询直播间分钟级趋势数据时，默认使用 `pay_order_gmv_minute_trend` 和 `pay_order_cnt_minute_trend` 字段，分别表示成交金额和成交订单数的趋势
- **链接提示**：在展示完直播间数据后，必须在最终回答后添加一句话：「更多详情，欢迎访问：https://data.bytedance.net/life/application/liveScreen/home?room_id={selected_room_id} 」（其中 {selected_room_id} 替换为实际的直播间ID）

详细的数据展示格式、JSON 数据解析逻辑、展示示例等内容见 `references/live.md`。

---

## References

- `references/live.md` — data-life-live 直播管理命令速查和详细规范
- `references/invocation.md` — 通用调用方式
- `references/troubleshooting.md` — 常见问题与处理