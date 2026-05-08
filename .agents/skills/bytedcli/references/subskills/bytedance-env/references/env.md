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

# 设备管理
bytedcli env device list --env "ppe_demo" --standard-env online_i18nbd
bytedcli env device add --env "ppe_demo" --standard-env online_i18nbd --device-id 4252524525 --expire-at "2026-02-19T01:19:40.471Z"
bytedcli env device update --env "ppe_demo" --standard-env online_i18nbd --device-id 4252524525 --expire-at "2026-02-19T09:19:58+08:00"
bytedcli env device unbind --standard-env online_i18nbd --device-id 4252524525

# 工单
bytedcli env ticket list --env "ppe_demo" --standard-env online_i18nbd --page 1 --size 10
bytedcli env ticket get --ticket-id 2021755505366867968 --standard-env online_i18nbd
```
