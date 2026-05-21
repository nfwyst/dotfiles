---
name: bytedance-api-test
description: "Query service API list and make HTTP API calls, RPC calls, or generate request examples via bytedcli: list available APIs for a service using Api Test, make HTTP calls to test service endpoints, invoke RPC methods, or generate request parameter examples from IDL. Use when tasks need to query what APIs are available for a given PSM, inspect API definitions from codebase (MR branch) or BAM IDL versions, directly invoke HTTP endpoints for testing, call RPC methods, or generate request examples for testing."
---

# bytedcli API Test

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

- 查询某个服务（PSM）下有哪些可用 API
- 通过 MR 分支名称获取 codebase 中的 API 列表
- 通过 BAM IDL 版本号获取 BAM 中的 API 列表
- 对服务 HTTP 端点进行测试调用
- 调用服务的 RPC 方法进行测试

## 前置条件

- 使用通用调用方式：`references/invocation.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

### 1. list-apis - 列出服务 API

```bash
# 从 codebase 查询 (idl_source=1 需要 MR 分支名作为 idl_version)
bytedcli api-test list-apis --psm "example.service.api" --idl-source 1 --idl-version "mr-branch-name"

# 从 BAM 查询 (idl_source=2 需要 BAM IDL 版本号作为 idl_version)
bytedcli api-test list-apis --psm "example.service.api" --idl-source 2 --idl-version "1.0.0"

# JSON 模式输出
bytedcli --json api-test list-apis --psm "example.service.api" --idl-source 1 --idl-version "main"
```

### 2. http-call - HTTP API 调用

```bash
# GET 请求
bytedcli api-test http-call "example.service.api" --http-path "/api/v1/user" --env prod --idc lf

# POST 请求带 body
bytedcli api-test http-call "example.service.api" --http-method POST --http-path "/api/v1/user" --env prod --idc lf --body '{"name":"test"}'

# 带认证 header
bytedcli api-test http-call "example.service.api" --http-path "/api/v1/user" --env prod --idc lf --header "authorization:Bearer token123"

# 指定目标实例地址
bytedcli api-test http-call "example.service.api" --http-path "/api/v1/user" --env prod --idc lf --address "127.0.0.1:8080"

# JSON 模式输出
bytedcli --json api-test http-call "example.service.api" --http-path "/api/v1/user" --env prod --idc lf
```

### 3. rpc-call - RPC 调用

```bash
# 使用 BAM IDL 版本调用（推荐，自动推断 idl-source）
bytedcli api-test rpc-call "example.service.api" "DemoMethod" --idl-version "1.2.3" --env prod --idc lf --body '{}'

# 使用 branch ref 调用
bytedcli api-test rpc-call "example.service.api" "DemoMethod" --idl-version "main" --idl-source branch --env prod --idc lf --body '{}'

# 指定 zone、cluster 和 control-plane
bytedcli api-test rpc-call "example.service.api" "DemoMethod" --idl-version "1.2.3" --zone BOE --idc lf --env prod --cluster default --control-plane "demo-control-plane" --body '{"id":123}'

# 指定目标实例地址
bytedcli api-test rpc-call "example.service.api" "DemoMethod" --idl-version "1.2.3" --env prod --idc lf --body '{}' --address "127.0.0.1:8080"

# JSON 模式输出
bytedcli --json api-test rpc-call "example.service.api" "DemoMethod" --idl-version "1.2.3" --env prod --idc lf --body '{}'

# 非 JSON 模式输出带上 log_id
bytedcli api-test rpc-call "example.service.api" "DemoMethod" --idl-version "1.2.3" --env prod --idc lf --body '{}' --with-logid

# 权限不足时创建对应权限申请工单
bytedcli --json api-test rpc-call "example.service.api" "DemoMethod" --idl-version "1.2.3" --env prod --idc lf --body '{}' --create-permission-ticket --permission-reason "Need API Test access for verification"
```

### 4. gen-request - 生成请求参数示例

根据 IDL 生成请求参数的示例代码，支持 RPC 和 HTTP 协议。

```bash
# 使用 BAM IDL 版本生成请求参数
bytedcli api-test gen-request --psm "example.service.api" --protocol rpc --function-name "DeleteApiV3BoeDevice" --idl-source 2 --idl-version "1.0.1162"

# 使用 codebase 分支生成请求参数
bytedcli api-test gen-request --psm "example.service.api" --protocol rpc --function-name "DeleteApiV3BoeDevice" --idl-source 1 --idl-version "master"

# 指定环境
bytedcli api-test gen-request --psm "example.service.api" --protocol rpc --function-name "DeleteApiV3BoeDevice" --idl-source 2 --idl-version "1.0.1162" --env prod

# JSON 模式输出
bytedcli --json api-test gen-request --psm "example.service.api" --protocol rpc --function-name "DeleteApiV3BoeDevice" --idl-source 2 --idl-version "1.0.1162"
```

### 5. pb-call - PB（improto.Command）接口调用

测试「走统一 `Serve(GatewayRequest)` 入口、按 `improto.Command` 分发」的 PB 接口。method 固定为 `Serve`，业务 Command 与请求体由命令内部封包。

```bash
# 按 Command 名调用
bytedcli api-test pb-call --psm "example.service.api" --command EXAMPLE_DEMO_COMMAND --user-id 100001 --idl-version "main" --idc lf --env prod --body '{}'

# 按 Command 数字 + 显式指定请求/响应消息类型
bytedcli api-test pb-call --psm "example.service.api" --command 1001 --user-id 100001 --idl-version "main" --idc lf --env prod --body '{"folder_id":"INBOX"}' --request-message example.DemoRequest --response-message example.DemoResponse

# 列出可用 Command（不发请求，可用 --grep 过滤）
bytedcli api-test pb-call --psm "example.service.api" --idl-version "main" --idc lf --env prod --list-commands --grep demo

# JSON 模式输出
bytedcli --json api-test pb-call --psm "example.service.api" --command EXAMPLE_DEMO_COMMAND --user-id 100001 --idl-version "main" --idc lf --env prod --body '{}'
```

## list-apis 参数说明

| 参数            | 说明                                                                           |
| --------------- | ------------------------------------------------------------------------------ |
| `--psm`         | PSM 名称，如 `example.service.api`                                             |
| `--idl-source`  | IDL 来源：`1` 表示 codebase（需要 MR 分支名），`2` 表示 BAM（需要 IDL 版本号） |
| `--idl-version` | 当 `idl-source=1` 时为 MR 分支名称；当 `idl-source=2` 时为 BAM IDL 版本号      |

## http-call 参数说明

| 参数                | 说明                                    | 必填 |
| ------------------- | --------------------------------------- | ---- |
| `[psm]`             | 服务 PSM                                | 是   |
| `--http-path`       | HTTP 请求路径                           | 是   |
| `--env`             | 环境                                    | 是   |
| `--idc`             | 服务部署 IDC，如 `lf/my/sg`             | 是   |
| `--http-method`     | HTTP 方法，默认 GET                     | 否   |
| `--zone`            | 区域，默认 CN                           | 否   |
| `--cluster`         | 集群，默认 default                      | 否   |
| `--address`         | 目标实例 IP 地址 + 端口号，默认空字符串 | 否   |
| `--header`          | 请求头，格式 `key:value`（可重复）      | 否   |
| `--body`            | 请求体 JSON 字符串                      | 否   |
| `--body-file`       | 请求体文件路径                          | 否   |
| `--request-timeout` | 请求超时毫秒，默认 60000                | 否   |
| `--protocol`        | 协议，默认 http                         | 否   |

## rpc-call 参数说明

| 参数                         | 说明                                                                                    | 必填 |
| ---------------------------- | --------------------------------------------------------------------------------------- | ---- |
| `[psm]`                      | 服务 PSM                                                                                | 是   |
| `[method]`                   | 方法名称                                                                                | 是   |
| `--idl-version`              | IDL 版本（BAM 版本号或 MR 分支名）                                                      | 是   |
| `--env`                      | 环境                                                                                    | 是   |
| `--idc`                      | 服务部署 IDC，如 `lf/my/sg`                                                             | 是   |
| `--idl-source`               | IDL 来源：`branch`（默认）或 `bam`，默认从 `--idl-version` 推断                         | 否   |
| `--zone`                     | 区域，默认 CN                                                                           | 否   |
| `--cluster`                  | 集群，默认 default                                                                      | 否   |
| `--control-plane`            | 控制平面（可选）                                                                        | 否   |
| `--address`                  | 目标实例地址（可选，不传则由平台自动路由）                                              | 否   |
| `--body`                     | 请求体 JSON 字符串                                                                      | 否   |
| `--body-file`                | 请求体文件路径                                                                          | 否   |
| `--request-timeout`          | 请求超时毫秒，默认 60000                                                                | 否   |
| `--connect-timeout`          | 连接超时毫秒，默认 60000                                                                | 否   |
| `--with-logid`               | 非 JSON 模式下先输出 `log_id: xxx` 再输出 resp_body（默认 false）                       | 否   |
| `--create-permission-ticket` | 当 RPC 返回 `has_permission=false` 时，按 RBAC/SCP 检查结果创建对应权限工单；已有 `permission_link` 时直接复用 | 否   |
| `--permission-reason`        | 创建权限申请工单时使用的申请原因，默认 `Need API Test access for verification.`         | 否   |
| `--permission-role`          | IAM role id；已知 `ms.interfacetesting.access` 会默认映射到 `ms.interface_tester.cn`    | 否   |
| `--permission-source-url`    | 写入 IAM exception 的来源 URL，默认生成 Bits interface_test URL                         | 否   |

## gen-request 参数说明

| 参数                | 说明                                                                           | 必填 |
| ------------------- | ------------------------------------------------------------------------------ | ---- |
| `--psm`             | PSM 名称，如 `example.service.api`                                             | 是   |
| `--protocol`        | 协议类型，如 `rpc` 或 `http`                                                   | 是   |
| `--function-name`   | 函数/方法名称                                                                  | 是   |
| `--idl-source`      | IDL 来源：`1` 表示 codebase（需要 MR 分支名），`2` 表示 BAM（需要 IDL 版本号） | 是   |
| `--idl-version`     | 当 `idl-source=1` 时为 MR 分支名称；当 `idl-source=2` 时为 BAM IDL 版本号      | 是   |
| `--env`             | 环境，如 `prod`（可选）                                                        | 否   |
| `--query`           | Query JSON 字符串（可选，默认 `{}`）                                           | 否   |
| `--body`            | Body JSON 字符串（可选，默认 `{}`）                                            | 否   |
| `--headers`         | Headers JSON 字符串（可选，默认 `{}`）                                         | 否   |
| `--cookies`         | Cookies JSON 字符串（可选，默认 `{}`）                                         | 否   |
| `--generate-source` | 生成来源（可选，默认 1）                                                       | 否   |
| `--generate-method` | 生成方法（可选，默认 1）                                                       | 否   |

## pb-call 参数说明

| 参数 | 说明 | 必填 |
| --- | --- | --- |
| `--psm` | 服务 PSM | 是 |
| `--command` | improto.Command 枚举名或数字 | 是 |
| `--user-id` | GatewayRequest.user_id（i64）；由调用方自备，bytedcli 不做任何身份解析/转换 | 是 |
| `--idl-version` | 目标服务 thrift IDL 版本（BAM 版本号或 MR 分支名） | 是 |
| `--idc` | 服务部署 IDC，如 lf/my/sg | 是 |
| `--env` | 环境 | 是 |
| `--body` | 业务请求体 JSON 字符串（与 --body-file 二选一） | 否 |
| `--body-file` | 业务请求体文件路径 | 否 |
| `--proto-version` | improto .proto 版本（分支/tag/SHA/go.mod 伪版本），默认 master，通常无需指定 | 否 |
| `--idl-source` | IDL 来源：branch 或 bam，默认从 --idl-version 推断 | 否 |
| `--zone` | 区域，默认 CN | 否 |
| `--cluster` | 集群，默认 default | 否 |
| `--device-id` | GatewayRequest.device_id（i64），默认 0 | 否 |
| `--version` | GatewayRequest.version（i32），默认 0 | 否 |
| `--request-id` | GatewayRequest.request_id，默认自动生成 | 否 |
| `--context` | GatewayRequest.context 项，格式 key=value（可重复） | 否 |
| `--request-message` | 显式指定请求消息类型，如 example.DemoRequest（默认按命名约定解析） | 否 |
| `--response-message` | 显式指定响应消息类型（默认按命名约定解析） | 否 |
| `--list-commands` | 列出 improto.Command 候选并退出（配 --grep 过滤），不发请求 | 否 |

## Notes

- list-apis 必填参数：`--psm`、`--idl-source`、`--idl-version`，缺少任一会自动输出帮助信息
- http-call 必填参数：`[psm]`、`--http-path`、`--env`、`--idc`，缺少任一会自动输出帮助信息
- rpc-call 必填参数：`[psm]`、`[method]`、`--idl-version`、`--env`、`--idc`，缺少任一会自动输出帮助信息
- gen-request 必填参数：`--psm`、`--protocol`、`--function-name`、`--idl-source`、`--idl-version`，缺少任一会自动输出帮助信息
- pb-call 必填参数：`--psm`、`--command`、`--user-id`、`--idl-version`、`--idc`、`--env`，且 `--body`/`--body-file` 二选一，缺少会自动输出帮助信息
- 需要结构化输出加 `--json`（全局选项，放在子命令之前）
- list-apis 返回数据包含 `func_name`（方法名）、`method`（HTTP 方法）、`path`（API 路径）
- rpc-call 自动从 `--idl-version` 格式推断 IDL 来源：符合 `X.Y.Z` 格式为 `bam`，否则为 `branch`
- rpc-call 返回 `has_permission=false` 且包含 `escape_params` 时，会自动调用 IAM 权限检查；JSON 输出包含 `permission_check`，文本输出包含管控结果、拦截原因和可申请链接
- rpc-call 默认不会创建权限申请工单；只有显式传 `--create-permission-ticket` 才会按 RBAC/SCP 检查结果调用对应写接口。未知 RBAC permission 需要传 `--permission-role`，不要猜 role。
- gen-request 使用 SSE 流式输出，逐步返回生成的请求参数，最终 JSON 结果包含完整的 query 和 body
- pb-call 用于「服务只暴露一个统一 Serve 入口、再按 improto.Command 分发」的 PB 接口（飞书 mail 即是）；方法名固定用 Serve，命令号与请求内容由 pb-call 自动打包，无需手动构造
- pb-call 的 `--user-id` 等身份字段由调用方直接传入，bytedcli 不做邮箱转 ID 之类的解析/转换（命令通用，不绑某条业务线）
- pb-call 的 `--body` 里超过约 19 位的大整数 ID 会原样保留，不会因常规 JSON 解析丢精度
- pb-call 按此顺序确定命令对应的请求/响应数据结构：先用显式传入的 `--request-message`/`--response-message`；未传时按命名规律（如 `GET_MAIL_SETTINGS` 找 `GetMailSettingsRequest`/`GetMailSettingsResponse`）在已加载 proto 的所有包中查找，唯一命中即用；多个包出现同名时会报错并提示用 `--request-message`/`--response-message` 指定

## References

- `references/api-test.md`
- `references/invocation.md`
- `references/troubleshooting.md`
