---
name: bytedance-bytestable-wcc
description: "Operate WCC (Webcast Config Center) via bytedcli: inspect services, namespaces, envs, and configs; create configs; update config metadata, struct definitions, and values; and manage related deployments, codegen, and publish tickets. Use when tasks mention WCC, Webcast Config Center, WCC config, 配置新建, 配置更新, 快速发布, 配置工单, or service PSM config management."
---

# bytedcli Bytestable WCC

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

- 查询 WCC service / namespace / env / config
- 新建配置：`config create`
- 更新配置元信息或结构定义：`config update-meta`、`config update-struct`
- 更新配置值：`config update-value`
- 查询最新部署或部署历史：`deployment latest`、`deployment list`
- 触发或查询代码生成：`codegen trigger`、`codegen status`
- 在明确需要发起配置发布时创建工单：`ticket create`

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 先完成登录：`bytedcli auth login`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 服务 / namespace / env
bytedcli bytestable wcc service list --keyword "example.service"
bytedcli bytestable wcc service get --psm "example.service"
bytedcli bytestable wcc service get --service-id 2924
bytedcli bytestable wcc namespace list "example.service"
bytedcli bytestable wcc env list "example.service"
# 若服务尚无可用 PPE 环境，可先创建测试 env
bytedcli bytestable wcc env create "example.service" "ppe_demo" --region cn

# 配置查询 / 新建 / 更新
bytedcli bytestable wcc config list "example.service" --namespace default --env prod --keyword "demo"
bytedcli bytestable wcc config get "example.service" "demo_conf" --namespace default --env prod
bytedcli bytestable wcc config create "example.service" "demo_conf" --namespace default --type json --env prod
bytedcli bytestable wcc config update-meta "example.service" "demo_conf" --namespace default --env prod --description "updated desc"
bytedcli bytestable wcc config update-struct "example.service" "demo_conf" --struct-file ./struct.go

# 配置值更新 / 部署记录
bytedcli bytestable wcc config update-value "example.service" "demo_conf" --namespace default --env ppe_demo --value-file ./value.json
bytedcli bytestable wcc deployment latest "example.service"
bytedcli bytestable wcc deployment list "example.service" --env prod --page 1 --page-size 20

# 代码生成
bytedcli bytestable wcc codegen trigger "example.service"
bytedcli bytestable wcc codegen trigger "example.service" --async
bytedcli bytestable wcc codegen status "example.service"

# 明确需要发起发布时再创建工单
bytedcli bytestable wcc ticket create "example.service" \
  --namespace default \
  --reviewers "owner1,owner2" \
  --regions cn,boe \
  --config-key "demo_conf" \
  --value-file ./value.json \
  --extra-canary-guard-psms "quality.psm"

# Agent 场景建议加 --json
bytedcli --json bytestable wcc config get "example.service" "demo_conf" --env prod
bytedcli --json bytestable wcc deployment list "example.service" --env prod
bytedcli --json bytestable wcc ticket create "example.service" --reviewers "owner1,owner2" --config-key "demo_conf" --value-file ./value.json
```

## 编码与 WCC 使用流程

当任务涉及“新增配置 / 修改配置并落地到代码”时，按下面流程执行，不要中途停止在某一步。

1. 先规范化并确认 PSM
   - WCC 的 service 标识只接受 `P.S.M` 格式，例如 `webcast.game.creator`。
   - 若用户输入是下划线形式（如 `webcast_game_creator`），先转换为点分形式再查询；不要直接用下划线去查 WCC。
   - 推荐顺序：先 `service get --psm "<psm>"`；如果用户只给了模糊关键词，再用 `service list --keyword "<keyword>"` 反查并确认最终 PSM。
2. 确认目标环境；PPE 缺失时要创建，不要直接结束
   - 先执行 `env list "<psm>"` 检查目标环境是否存在。
   - 如果用户明确给了 PPE 环境名，但 `env list` 里没有，下一步应执行 `env create "<psm>" "<env>"` 创建，再继续后续配置动作。
   - region 可按 env 前缀推断：`ppe_` 通常用 `--region cn`，`boe_` 通常用 `--region boe`；若无法判断再向用户确认。
3. 新建或更新 JSON 类型 config 后必须补齐或更新 struct 与执行 codegen
   - 仅执行 `config create` + `config update-value` 不够，会导致 JSON 配置结构不完整、代码侧拉取或反序列化失败。
   - 新建 JSON 配置的标准链路：`config create` -> `config update-struct` -> `codegen trigger`（建议不带 `--async`）-> `config update-value`。
   - 更新 JSON 配置的标准链路：`config update-value` -> `config update-struct` -> `codegen trigger`（建议不带 `--async`）
   - 如果是“已有 config 只改值”，但无法确认 struct 是否已配置，先 `config get` 检查；未配置则先补 `update-struct + codegen`，再更新值。
4. 在项目中拉取新 codegen 的代码
   - 在执行 `codegen trigger` 或 `codegen trigger --async` + `codegen status` 后能看到新生成的 WCC SDK 代码 Version 与 go get 命令，需要在项目中拉取新的 WCC SDK 代码版本，项目中 WCC 配置拉取才可以正常运行。
5. 完成后做最小校验
   - 至少执行一次 `config get`（带目标 env）确认值已生效。
   - 若任务目标包含“让代码可用”，确认 codegen 状态已完成，不要只停留在 value 更新成功。

## Notes

- WCC 当前默认走国内控制台接口 `yun.bytedance.net` / `general-f2b-api.bytedance.net`，鉴权依赖 `bytedcli auth login` 后可复用的浏览器会话 cookie。
- WCC 的服务标识使用标准 PSM 写法，例如 `demo.example.service`；不要写成 `DEMO_EXAMPLE_SERVICE`、`demo_example_service` 或其他下划线形式。凡是文档里的 `<psm>`、`--psm`，都按 `P.S.M` 理解和填写。
- 如果用户或上下文提供的是下划线形式（如 `demo_example_service`），Agent 必须先转成点分 PSM（`demo.example.service`）再执行 WCC 命令，不能直接把下划线值传给 WCC。
- 大多数 WCC 子命令使用位置参数 `<psm>` 作为服务选择器；只有 `bytestable wcc service get` 使用 `--psm` 或 `--service-id` 二选一。
- 未显式传 `--namespace` 时默认使用 `default`；如果服务只有一个 namespace，CLI 也会自动回退到该唯一值。
- `bytestable wcc config get` 未传 `--env` 时默认读取 `prod`；如果目标 env 没有独立变更记录，会自动回退到 `prod` 基准配置。
- 所有携带 `--env` 的 WCC 子命令都会统一校验 env：`prod` 默认合法；`ppe_` / `boe_` 开头时必须能在该服务的 env list 中找到；其他前缀会直接视为非法输入。
- `bytestable wcc config create` 用于新建配置元信息；`bytestable wcc config update-meta` / `bytestable wcc config update-struct` 用于更新已有配置的描述、类型、tag 或 struct 定义。
- 在编码、自测、联调阶段，默认使用 `bytestable wcc config update-value` 更新测试环境配置值；不要直接把 `bytestable wcc ticket create` 当作日常调试入口。
- 若用户没有明确说明需要创建 prod 发布单，优先在 PPE 环境完成验证；如果还不知道该服务可用的 PPE env，先执行 `bytestable wcc env list` 查询，再决定使用哪个 env。
- 若用户明确指定了 PPE 环境，但 `env list` 查不到该 env，Agent 应继续执行 `bytestable wcc env create` 创建后再继续，而不是在“环境不存在”处停止。
- 若服务当前没有 PPE 环境且用户尚未指定 env，优先提议并创建一个合规 PPE env，再继续联调；只有在确实没有 PPE 方案且用户明确接受时，才改走其他测试环境。
- `bytestable wcc config update-value` 只支持 env 名以 `ppe_` 或 `boe_` 开头的快速发布环境，并会自动补齐当前副本的 `type`、`product_id` 和 `last_value`。
- 涉及新建 JSON 类型的 config 或使用 `bytestable wcc config update-value` 更新 JSON 类型的 config 值后导致 JSON 格式发生变化的任务，默认流程必须包含 `config update-struct` 与 `codegen trigger`；不要只做 `config create` + `config update-value`。
- `bytestable wcc ticket create` 只用于测试环境验证完成后的发布阶段。只有当用户明确要求发起上线单，或明确要求发布到正式环境时，才推荐或执行这条命令。
- `bytestable wcc ticket create` 固定使用 WCC 的 BOE feature 发布链路，不再暴露 env / envType 参数；`--reviewers` 必填，reviewer 不能是当前用户，且必须属于该服务 Owner 列表。
- `bytestable wcc ticket create` 支持 `--config-key-values-json` / `--config-key-values-file` 批量提交；`--regions` 可一次传多个 region，会同步展开到 ticket 和每条 key/value 记录。
- `bytestable wcc env create` 会按 region 校验 env name 前缀：CN 系列必须以 `ppe_` 开头，BOE 系列必须以 `boe_` 开头。
- `bytestable wcc codegen trigger --async` 会每隔 1 秒轮询一次 codegen status，直到 state 不再是 `running`。
- 需要结构化输出时，使用全局 `--json`，并放在 `bytestable` 前面，例如 `bytedcli --json bytestable wcc config list ...`。

## References

- `references/invocation.md`
- `references/troubleshooting.md`
