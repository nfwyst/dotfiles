---
name: bytedance-byteconf
description: "Operate Byteconf MVP via bytedcli: list/get/update conf items, route across tenants and regions with --region (such as bytedance, boe, sinf, sg), and rely on Bytecloud SSO JWT authentication under the hood. Use when tasks mention byteconf、配置中心、conf 查询、conf 更新、按 region 切换网关路由，或需要通过 bytedcli 读取/修改 Byteconf 配置项。"
---

# bytedcli Byteconf

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

- 需要列出 Byteconf 配置项（`conf list`）
- 需要读取单个配置项详情（`conf get`）
- 需要更新配置项 payload，或先 `--dry-run` 检查最终请求体（`conf update`）
- 需要通过 `--region` 在不同租户/区域网关之间自动路由，例如 `bytedance`、`boe`、`sinf`、`sg`
- 需要确认 Byteconf 请求是否基于 Bytecloud SSO JWT 完成鉴权

## 前置条件

- 按通用调用方式执行命令（含内网 registry）：`references/invocation.md`
- 需要鉴权的命令先登录：`bytedcli auth login`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

**命令行结构**：`bytedcli [全局选项] byteconf conf <子命令> [命令选项]`

| 类别 | 选项 | 位置 | 说明 |
| --- | --- | --- | --- |
| 全局选项 | `--json`、`--site`、`--http-debug` | `bytedcli` 之后、子命令之前 | 对所有子命令生效 |
| 命令选项 | `--ns-key`、`--biz-tree-path`、`--keyword`、`--id`、`--version`、`--region`、`--from`、`--query-json`、`--body-json`、`--dry-run` | 子命令之后 | 仅对当前子命令生效 |

**推荐格式**：`bytedcli --json byteconf conf list --ns-key "demo" --region "sg"`

```bash
# 列表查询
bytedcli --json byteconf conf list --ns-key "demo" --page 1 --page-size 20
bytedcli --json byteconf conf list --ns-key "demo" --biz-tree-path "a/b/c" --keyword "feature_flag"
bytedcli --json byteconf conf list --ns-key "demo" --region "sg"
bytedcli --json byteconf conf list --from ./query.json --query-json '{"page":2}' --region "sinf"

# 详情读取
bytedcli --json byteconf conf get --id 123 --version 1 --ns-key "demo"
bytedcli --json byteconf conf get --id 123 --version 7 --name "demo_conf" --biz-tree-path "a/b/c" --region "boe"

# 更新配置：先 dry-run，再真实发起
bytedcli --json byteconf conf update --id 123 --version 7 --body-json '{"base":{"k":"v"}}' --dry-run
bytedcli --json byteconf conf update --id 123 --version 7 --from ./payload.json --region "sg"
```

## 推荐工作流

1. 不确定目标配置版本时，先执行 `conf list` 缩小范围。
2. 拿到 `id` 后，再执行 `conf get` 读取当前配置详情。
3. 更新前优先用 `conf update --dry-run` 检查最终 payload。
4. 确认 payload 无误后，再执行真实的 `conf update`。
5. 如果用户明确指定海外或测试环境，显式传 `--region`，不要依赖默认路由。

## 参数与行为说明

### `byteconf conf list`

- 支持 `--ns-key`、`--biz-tree-path`、`--keyword`、`--page`、`--page-size`
- 支持 `--from <path>` 读取基础 query JSON，再用 `--query-json` / 显式参数覆盖
- `--region` 默认值为 `bytedance`

### `byteconf conf get`

- `--id` 必填
- `--version` 默认值为 `1`
- 可选补充 `--name`、`--ns-key`、`--biz-tree-path`
- 当用户只知道名称或 namespace 时，先用 `conf list` 查出正确 `id` 和最新版本

### `byteconf conf update`

- `--id`、`--version` 必填
- `--from` 与 `--body-json` 至少提供一个
- `--dry-run` 只输出最终 payload，不实际发请求
- 支持把 `id`、`version` 放入 body，但更推荐显式传参，避免覆盖错误

## Notes

- 需要结构化输出时，默认加 `--json`，并放在 `byteconf` 之前，例如：`bytedcli --json byteconf conf get --id 123 --version 1`
- `--region` 传给底层 `x-bcgw-tenant-id`，同时用于选择对应网关 origin；它既可能表示默认租户 `bytedance`，也可能表示特定区域/租户，如 `boe`、`sg`、`sinf`
- 当前实现的默认租户是 `bytedance`
- 底层鉴权使用 Bytecloud SSO JWT，请先确保 `bytedcli auth status` 正常；CLI 会把 JWT 注入到 `x-jwt-token` 请求头
- `conf get` 默认 `version=1`。如果用户要“最新版本”，应先 `list` 确认版本，再读取或更新
- `conf update` 要求输入为合法 JSON 对象；如果 payload 不确定，优先落文件后通过 `--from` 传入

## References

- `references/byteconf.md`
- `references/invocation.md`
