# ENV

```bash
# 站点与动态 standard_env 列表
bytedcli env site list

# 收藏/管理 ENV
bytedcli env list-starred --page 1 --size 10
bytedcli env list-managed --page 1 --size 10

# 按环境标识搜索
bytedcli env search --keyword "ppe_coze" --env-site cn,boe

# 按服务搜索
bytedcli env search-service --service "example.service.api" --env-site cn,boe

# 列出 ENV 下的服务列表（instance_meta API）
bytedcli env service list --env "ppe_qianchuan2" --standard-env online_cn
bytedcli env service list --env "ppe_qianchuan2" --standard-env online_cn --service-types tce --page 1 --page-size 20

# 创建流程相关
bytedcli env site baseline-list
bytedcli env site baseline-zones --standard-env online_cn
bytedcli env check-name --name "ppe_demo" --standard-env online_cn
bytedcli env create --name "ppe_demo" --standard-env online_cn --idc LF --visibility private

# 部署与升级
bytedcli env service deploy-tce --env "ppe_demo" --standard-env online_i18nbd --psm "flow.bot.open_gateway" --flow-base prod
# 自定义资源租期：UI"添加服务"弹窗里的"租期"输入框对应 --lease-days，--lease-rule-id 透传系统策略 id
bytedcli env service deploy-tce --env "boe_demo" --standard-env boe --psm "demo.sample.svc" --flow-base prod --lease-days 2 --lease-rule-id 145
bytedcli env service deploy-tcc --env "ppe_demo" --standard-env online_i18nbd --psm "ocean.cloud.bot_adapter"
bytedcli env service upgrade-tce --env "ppe_demo" --standard-env online_i18nbd --psm "flow.bot.open_gateway" --cluster-id 350079955 --flow-base prod --scm-env-type prod

# 集群模板（cluster_param_template）：等价 UI"集群模板"下拉，一次部署多集群分集群配置
bytedcli env service list-cluster-templates --psm "demo.psm.tce" --standard-env online_cn
bytedcli env service deploy-tce --env "ppe_demo" --standard-env online_cn --psm "demo.psm.tce" --cluster-template-name "上次所选集群"
bytedcli env service deploy-tce --env "ppe_demo" --standard-env online_cn --psm "demo.psm.tce" --cluster-template-id 22708

# PPE bytefaas 部署 / 升级
bytedcli env service deploy-bytefaas --env "ppe_demo_swimlane" --standard-env online_cn --psm "demo.psm.faas"
bytedcli env service deploy-bytefaas --env "ppe_demo_swimlane" --standard-env online_cn --psm "demo.psm.faas" --scm-version "1.0.0.123"
bytedcli env service deploy-bytefaas --env "ppe_demo_swimlane" --standard-env online_cn --psm "demo.psm.faas" --region cn-north --cluster faas-cn-north
bytedcli env service upgrade-bytefaas --env "ppe_demo_swimlane" --standard-env online_cn --psm "demo.psm.faas" --scm-version "1.0.0.124"

# 设备管理
bytedcli env device list --env "ppe_demo" --standard-env online_i18nbd
bytedcli env device add --env "ppe_demo" --standard-env online_i18nbd --device-id 4252524525 --expire-at "2026-02-19T01:19:40.471Z"
bytedcli env device update --env "ppe_demo" --standard-env online_i18nbd --device-id 4252524525 --expire-at "2026-02-19T09:19:58+08:00"
bytedcli env device unbind --standard-env online_i18nbd --device-id 4252524525

# 工单
bytedcli env ticket list --env "ppe_demo" --standard-env online_i18nbd --page 1 --size 10
bytedcli env ticket get --ticket-id 2021755505366867968 --standard-env online_i18nbd
```

## PPE bytefaas deployment

`env service deploy-bytefaas` 把一个 bytefaas（ByteCloud FaaS）服务挂载到 PPE 泳道，
`env service upgrade-bytefaas` 把已挂载实例切换到新的 SCM 版本。两者都走 **ENV 平台**，
是测试/泳道部署链路，**不**是生产发布。

生产 cluster 的正式发布使用 `bytedcli faas release create`（见 `bytedance-faas` skill），
两条链路互不替代。

### 必填与默认值

| 参数 | 说明 |
| --- | --- |
| `--env` | 目标 PPE/泳道 ENV 名称（必填） |
| `--standard-env` | 基线 standard env，如 `online_cn` / `boe` / `online_i18nbd`（必填） |
| `--psm` | bytefaas 服务的 PSM（必填） |
| `--env-type` | env type 覆盖，默认按 `--standard-env` 推断 |
| `--region` | bytefaas region，默认 `cn-north` |
| `--cluster` | bytefaas cluster，默认 `faas-cn-north` |
| `--scm-version` | SCM 主仓版本号，省略时自动取 prod 基线最新版 |
| `--code-revision` | 指定 code revision id，省略时使用最新 revision |

### 示例

```bash
# 首次挂载到 PPE 泳道(自动取 prod 基线最新 SCM 版本)
bytedcli env service deploy-bytefaas \
  --env ppe_demo_swimlane --standard-env online_cn \
  --psm demo.psm.faas

# 显式指定 SCM 版本
bytedcli env service deploy-bytefaas \
  --env ppe_demo_swimlane --standard-env online_cn \
  --psm demo.psm.faas --scm-version 1.0.0.123

# 显式覆盖 region / cluster
bytedcli env service deploy-bytefaas \
  --env ppe_demo_swimlane --standard-env online_cn \
  --psm demo.psm.faas --region cn-north --cluster faas-cn-north

# 升级已挂载实例到新的 SCM 版本
bytedcli env service upgrade-bytefaas \
  --env ppe_demo_swimlane --standard-env online_cn \
  --psm demo.psm.faas --scm-version 1.0.0.124
```

### 常见误用

- 把 `--standard-env` 当成"泳道类型"：`online_cn` / `boe` 是基线，`ppe` 才是 env type；
  PPE 类型由命令名定位，需要覆盖时用 `--env-type`，不要把这两个参数互换。
- 试图传 git 分支或 ICM 镜像：目前 CLI 只支持 SCM 制品，
  不存在 `--branch` 或镜像标签参数。
- 试图自定义资源租期：PPE bytefaas 默认 14 天短回收，CLI 不暴露 `--lease-days`。
- 想做生产 cluster 正式发布却调用 `deploy-bytefaas`：这条命令只挂到 PPE 泳道；
  生产发布请改走 `bytedance-faas` skill 的 `faas release create`。
