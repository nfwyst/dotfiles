---
name: bytedance-tcc
description: "Operate TCC via bytedcli: list/search namespaces, list/get/decrypt configs, create/update/deploy configs, list directories, import base config, and inspect metadata. Use when tasks mention TCC or config center."
---

# bytedcli TCC

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

- Namespace/Config 查询
- 配置创建、更新、发布（通过 `--publish-mode` 控制发布策略）
- 目录查询与基准配置导入

## 前置条件

- 使用通用调用方式：`references/invocation.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

Commands are grouped under `tcc namespace`, `tcc config`, `tcc deployment`, `tcc env`, and `tcc site`. Old flat names (e.g. `tcc list-sites`, `tcc search-namespace`, `tcc get-config`) still work as hidden aliases.

```bash
bytedcli tcc site list
bytedcli --site cn tcc namespace list --page 1 --size 50
bytedcli --site cn tcc namespace search "keyword" --scope all --page 1 --size 50
bytedcli tcc config list "namespace" --region CN --keyword "demo" --dir-path "/default"
bytedcli tcc config get "namespace" "config_name" --region CN --dir "/default"
# View decrypted clear value for encrypted configs
bytedcli tcc config get "namespace" "config_name" --region CN --dir "/encrypt" --decrypt
bytedcli --site i18n-bd tcc config dir list "namespace" --env ppe_xxx
bytedcli --site i18n-bd tcc config meta list --env ppe_xxx
bytedcli --site cn tcc config create "namespace" "config_name" --env ppe --region CN --dir "/default" --description "demo config" --value "a: b"
bytedcli --site cn tcc config update "namespace" "config_name" --env ppe --region CN --value "a: b"
bytedcli --site cn tcc deployment deploy "namespace" "config_name" --env ppe --region CN --dir-path "/default"
bytedcli --site i18n-bd tcc config import "namespace" --config-ids "123,456" --target-env ppe_xxx
# Only create deployment, do not start (manual mode)
bytedcli tcc deployment deploy "namespace" "config_name" --env ppe --region CN --dir-path "/default" --publish-mode manual
# Deploy with review support (auto mode, default): auto-publish if no review, otherwise return review info
bytedcli --site cn tcc deployment deploy "namespace" "config_name" --env prod --region CN --dir-path "/default" --publish-mode auto
# Force auto-publish regardless of review requirement
bytedcli --site cn tcc deployment deploy "namespace" "config_name" --env prod --region CN --dir-path "/default" --publish-mode force-auto
# Query publish details by deployment ID or control-panel URL
bytedcli --site cn tcc deployment get "1234567890" --env prod
bytedcli tcc deployment get "https://example.com/tcc/namespace/demo.namespace/publish-details/1234567890??x-resource-account=demo&x-bc-region-id=example" --env prod
# Operate deployment or approve/reject current review step
bytedcli tcc deployment operate "1234567890" --operation start --env prod
bytedcli tcc deployment approve "https://example.com/tcc/namespace/demo.namespace/publish-details/1234567890??x-resource-account=demo&x-bc-region-id=example" --env prod
bytedcli tcc deployment reject "1234567890" --env prod
```

## Notes

- 环境/region/dir 建议显式指定
- `tcc config get` 支持 `--decrypt`，用于查看加密配置（`enable_encryption=true`）的明文值；不传 `--decrypt` 时加密配置只显示提示信息，不输出密文
- `tcc config list` 支持 `--keyword` 和 `--dir-path`，分别按配置名关键字与目录路径筛选结果
- `tcc deployment deploy` 支持 `--dir-path`，用于在同一 namespace 下存在同名配置时按目录锁定目标配置
- `tcc deployment deploy` 在策略类型为 `feature` 时，`--env` 仅支持 `ppe`/`ppe_*` 或 `boe`/`boe_*`（例如 `ppe_demo`、`boe_demo`）
- 使用全局 `--site` 选择站点（`cn|boe|i18n|i18n-bd|i18n-tt|us-ttp|eu-ttp`，别名：`prod` -> `cn`）。Per-service `--tcc-site` is a hidden alias for backward compatibility.
- 需要结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json tcc config list "namespace" --region CN ...`）
- `tcc config create` 需要显式传 `--description`；TCC Web 创建接口要求 description 非空，CLI 会先在本地校验
- `tcc config create` 在 `former_tcc` / `tcc_v2` namespace 上会自动回退到 V2 `service_id` 创建接口，不需要手写内部 API
- `tcc config update` 在 `former_tcc` / `tcc_v2` namespace 上会自动回退到 V2 `service_id` 的 `config/upsert/v2` 接口，按传入的 `--region` 和 `--dir` 更新对应副本
- `tcc config update` 遇到同步区域组时会自动补齐该组内所有已存在副本的 `extend_regions` 和 `update_base_version`；例如同一配置同时存在于 `CN` / `China-East` 时，不需要手动拆成多次更新，JSON 输出会返回实际覆盖的 `regions`
- `tcc deployment deploy` 在 `former_tcc` / `tcc_v2` namespace 上会自动切到 TCC AG 的 V2 发布链路：先用 `service_id` 读取配置，再调用 `config/upsert_deploy/v2` 创建或复用 activity 发布单，并按 `deployment/step_info` 判断是否继续推进 `next`；未发布配置会按目标最新版本构造 V2 deploy payload，并把备注写入 `config_data.note`
- `tcc deployment deploy` 遇到同步区域组时会自动补齐该组内所有已存在副本的 `config_changes` 与 `check_review conf_ids`；例如同一配置同时存在于 `CN` / `China-East` 时，不需要手动拆成多次发布，JSON 输出会返回实际覆盖的 `regions` / `config_ids`
- 如需区域并行发布，在命令中添加 `--region-parallel`
- `tcc deployment deploy` 通过 `--publish-mode` 控制发布策略：
  - `auto`（默认）：不需要 review 时会在每次操作前读取当前 `get_step`，并按当前步骤允许的前进操作自动推进（如 `start`、`next_batch`、`finish`）；需要 review 时创建审批工单并返回当前 review 工单信息
  - `manual`：只创建发布工单，不自动 start/finish
  - `force-auto`：无论是否需要 review，都尝试按当前步骤允许的前进操作自动推进
  - 被 SCP 策略封禁时，返回逃逸申请链接
- 当策略阶段配置了 `force_rolling=true` 时，`tcc deployment deploy` 会自动把对应阶段的 `enable_rolling` 一并置为 `true`，避免 Web 发布 payload 因滚动开关不一致被拒绝
- `tcc deployment get` 支持直接传 TCC 控制台 `publish-details` URL；未显式传 `--site` 时，会优先按 URL host 自动推断站点
- `tcc deployment get` 默认会并发调用 `get_step`，把当前步骤索引、阶段类型和 `allow_operations` 一起返回；若 `get_step` 失败，不会影响主查询结果。文本模式下拿到 step 信息时也会打印当前 step 摘要，方便继续执行 `tcc deployment operate`
- `tcc deployment operate` 直接透传底层 `deployment/operate`；未显式传 `--current-step-index` 时，会自动调用 `get_step` 推断当前步骤
- `tcc deployment approve` / `tcc deployment reject` 分别封装 review 步骤的 `review_pass` / `review_reject`

## References

- `references/tcc.md`
