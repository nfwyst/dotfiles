---
name: bytedance-env
description: "Operate ENV platform via bytedcli: list/search env, baseline create flow, deploy TCE/TCC, manage devices, and inspect tickets."
---

# bytedcli ENV

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

- 查看我收藏的 ENV
- 查看我管理的 ENV
- 按环境标识搜索 ENV
- 按服务（PSM）搜索 ENV
- 列出 ENV 下的服务列表
- 列出创建流程可选基准环境
- 查看基准环境可用机房
- 创建前校验环境名
- 创建 ENV
- 向 ENV 部署 TCE/TCC 服务
- 升级 TCE 服务（可指定集群和 SCM 依赖 env_type、SCM版本）
- 设备管理（新增/续期/解绑/列表）
- 工单查询（列表/详情）
- 需要跨站点（cn/boe/i18n-tt/i18n-bd/us-ttp/eu-ttp）统一查询

## 前置条件

- 使用通用调用方式：`references/invocation.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

Commands are grouped under `env site`, `env service`, `env device`, and `env ticket`. Old flat names (e.g. `env list-sites`, `env list-starred-env`, `env deploy-tce-service`) still work as hidden aliases.

```bash
# 查看站点与动态 standard_env 列表
bytedcli env site list

# 查看收藏/管理 ENV（默认查全部站点）
bytedcli env list-starred --page 1 --size 10
bytedcli env list-managed --page 1 --size 10

# 指定站点（支持重复或逗号）
bytedcli env list-starred --env-site cn --env-site boe
bytedcli env list-managed --env-site i18n-tt,us-ttp

# 按环境标识搜索
bytedcli env search --keyword "ppe_coze" --env-site eu-ttp

# 按服务搜索（先 service suggest，再按 psm 查询）
bytedcli env search-service --service "example.service.api" --env-site cn,boe

# 列出 ENV 下的服务列表
bytedcli env service list --env "ppe_qianchuan2" --standard-env online_cn
bytedcli env service list --env "ppe_qianchuan2" --standard-env online_cn --service-types tce --page 1 --page-size 20

# 创建流程：基准环境 / 机房 / 名称校验 / 创建
bytedcli env site baseline-list
bytedcli env site baseline-zones --standard-env online_cn
bytedcli env check-name --name "ppe_demo" --standard-env online_cn
bytedcli env create --name "ppe_demo" --standard-env online_cn --idc LF --visibility private

# 部署/升级服务
bytedcli env service deploy-tce --env "ppe_demo" --standard-env online_i18nbd --psm "flow.bot.open_gateway" --flow-base prod
# 自定义资源租期：UI"添加服务"弹窗里的"租期"输入框对应 --lease-days，--lease-rule-id 透传系统策略 id
bytedcli env service deploy-tce --env "boe_demo" --standard-env boe --psm "demo.sample.svc" --flow-base prod --lease-days 2 --lease-rule-id 145
bytedcli env service deploy-tcc --env "ppe_demo" --standard-env online_i18nbd --psm "ocean.cloud.bot_adapter"
bytedcli env service upgrade-tce --env "ppe_demo" --standard-env online_i18nbd --psm "flow.bot.open_gateway" --cluster-id 350079955 --flow-base prod --scm-env-type prod --scm-repo-version "1.0.0.370"

# 设备管理
bytedcli env device list --env "ppe_demo" --standard-env online_i18nbd
bytedcli env device add --env "ppe_demo" --standard-env online_i18nbd --device-id 4252524525 --expire-at "2026-02-19T01:19:40.471Z"
bytedcli env device update --env "ppe_demo" --standard-env online_i18nbd --device-id 4252524525 --expire-at "2026-02-19T09:19:58+08:00"
bytedcli env device unbind --standard-env online_i18nbd --device-id 4252524525

# 工单
bytedcli env ticket list --env "ppe_demo" --standard-env online_i18nbd --page 1 --size 10
bytedcli env ticket get --ticket-id 2021755505366867968 --standard-env online_i18nbd
```

## Notes

- 需要结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json env ticket get --ticket-id 2021755505366867968 ...`）
- `--env-site` 支持：`cn|boe|i18n-tt|i18n-bd|us-ttp|eu-ttp`
- `create` 名称规则：
  - `online_*` 必须 `ppe_` 前缀
  - `boe*` 必须 `boe_` 前缀
- Flag renames: `--page-num` is now `--page`; old names still work as hidden aliases

## References

- `references/env.md`
