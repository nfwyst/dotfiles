# Cronjob 日志查询工作流

查找 Cronjob 任务日志时，必须遵循以下步骤，特别是**确认控制面（站点）**。

## 1. 确认控制面 (Site)

**这是最关键的一步，必须先确认用户的控制面环境。**

Cronjob 在国内（China）和国际（I18n）环境是隔离的。如果不确认控制面，后续所有查询（Cluster ID、Job ID）都可能因为环境不匹配而失败。

### 操作逻辑

1. **如果用户已指定控制面**（例如提到 "I18n"、"TikTok"、"SG"、"US" 等关键词）：
   - 直接使用对应的 `--site` 参数或环境变量。
   - 参数详情参考：`skills/bytedance-cronjob/references/invocation.md`。

2. **如果用户未指定控制面**：
   - **必须先询问用户**：“请问您的任务是在国内环境（Prod）还是国际环境（I18n/TikTok）？”
   - **不要**盲目在默认环境（Prod）搜索，这会浪费时间并产生误导性的“未找到”结果。

### 常用站点值

| 用户描述             | 对应站点值 (`--site`) | 备注                 |
| :------------------- | :-------------------- | :------------------- |
| 国内、Prod、默认     | `prod`                | 默认值，无需额外指定 |
| TikTok、I18n、SG、US | `i18n-tt`             | 需单独鉴权           |
| ByteIntl、I18n-BD    | `i18n-bd`             | 复用 Prod 登录态     |
| BOE                  | `boe`                 | 测试环境             |

### 检查与鉴权

确定站点后，先检查连通性。若提示 `AUTH_REQUIRED`，需先登录：

```bash
# 示例：登录 i18n-tt 站点
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli auth login
```

## 2. 确认 Cluster ID 和 Job ID

知道集群名称（如 `sg1`、`default`）是不够的，API 需要数字 ID。

**注意**：以下命令中的 `<KEYWORD>` 是 PSM 名字模糊搜索的关键词，`<CLUSTER_NAME>`、`<REGION_NAME>` 均为占位符，**必须替换为用户实际提供的 PSM、机房名称或区域信息**。

### 方法 A：通过 PSM 搜索 (推荐)

直接搜索任务 PSM，查看其部署在哪些集群：

```bash
# 记得带上正确的 SITE 环境变量
# 将 <KEYWORD> 替换为用户提供的 PSM 或任务关键词 (如 "ies.vimo.async_task_worker")
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli --json cronjob list-jobs --search "<KEYWORD>"
```

在返回的 JSON 中，查看 `cluster` 数组，找到对应 `physical_cluster` (如 `<CLUSTER_NAME>`) 的 `id` (Cluster ID) 和 `job_id`。

### 方法 B：通过 List Zones 查找

如果知道区域名，可以列出所有区域的集群 ID：

```bash
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli --json cronjob list-zones
```

在输出中找到 `name: "<REGION_NAME>"` 或 `physical_cluster: "<CLUSTER_NAME>"` 对应的 `id`。

## 3. 获取实例详情与日志链接

使用 Cluster ID 和 实例名称（Instance Name / Task Name）获取详情。

**注意**：`<CLUSTER_ID>` 和 `<INSTANCE_NAME>` 必须根据前一步的查询结果和用户的输入进行替换。

```bash
# 替换 <CLUSTER_ID> 和 <INSTANCE_NAME>
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli --json cronjob get-instance \
  --cluster-id <CLUSTER_ID> \
  --instance-name "<INSTANCE_NAME>"
```

## 4. 提取 Argos 链接

在 `get-instance` 的 JSON 输出中，查找以下字段：

- `argos_stdout_view_log`: 标准输出日志链接
- `argos_stderr_view_log`: 错误日志链接
- `argos_usage_url`: 资源使用监控链接

直接点击链接即可跳转到 Argos 控制台查看日志。注意检查 Argos 页面右上角的时间范围是否覆盖了任务执行时间。
