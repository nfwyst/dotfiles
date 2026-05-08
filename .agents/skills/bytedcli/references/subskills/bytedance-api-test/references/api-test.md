# API Test

## 1. list-apis - 列出服务 API

```bash
# 从 codebase 查询 (idl_source=1 需要 MR 分支名作为 idl_version)
bytedcli api-test list-apis --psm "inf.hae.boe" --idl-source 1 --idl-version "cm_dev/java_ppe_debug"

# 从 BAM 查询 (idl_source=2 需要 BAM IDL 版本号作为 idl_version)
bytedcli api-test list-apis --psm "inf.hae.boe" --idl-source 2 --idl-version "1.0.0"

# JSON 模式输出
bytedcli --json api-test list-apis --psm "inf.hae.boe" --idl-source 1 --idl-version "main"
```

### list-apis 参数说明

| 参数 | 说明 |
|------|------|
| `--psm` | PSM 名称，如 `inf.hae.boe` |
| `--idl-source` | IDL 来源：`1` 表示 codebase（需要 MR 分支名），`2` 表示 BAM（需要 IDL 版本号） |
| `--idl-version` | 当 `idl-source=1` 时为 MR 分支名称；当 `idl-source=2` 时为 BAM IDL 版本号 |

### list-apis 返回字段

| 字段 | 说明 |
|------|------|
| `method` | HTTP 方法（GET/POST/PUT/DELETE） |
| `path` | API 路径 |
| `func_name` | 函数名称 |

## 2. http-call - HTTP API 调用

```bash
# GET 请求
bytedcli api-test http-call "inf.hae.boe" --http-path "/api/v1/user" --env prod --idc lf

# POST 请求带 body
bytedcli api-test http-call "inf.hae.boe" --http-method POST --http-path "/api/v1/user" --env prod --idc lf --body '{"name":"test"}'

# 带认证 header
bytedcli api-test http-call "inf.hae.boe" --http-path "/api/v1/user" --env prod --idc lf --header "authorization:Bearer token123"

# 指定 zone 和 cluster
bytedcli api-test http-call "inf.hae.boe" --http-path "/api/v1/user" --env prod --idc lf --zone BOE --cluster default

# 使用 body-file
bytedcli api-test http-call "inf.hae.boe" --http-method POST --http-path "/api/v1/user" --env prod --idc lf --body-file /tmp/request.json

# JSON 模式输出
bytedcli --json api-test http-call "inf.hae.boe" --http-path "/api/v1/user" --env prod --idc lf
```

### http-call 参数说明

| 参数 | 说明 | 必填 |
|------|------|------|
| `[psm]` | 服务 PSM | 是 |
| `--http-path` | HTTP 请求路径 | 是 |
| `--env` | 环境 | 是 |
| `--idc` | 服务部署 IDC，如 `lf/my/sg` | 是 |
| `--http-method` | HTTP 方法，默认 GET | 否 |
| `--zone` | 区域，默认 CN | 否 |
| `--cluster` | 集群，默认 default | 否 |
| `--address` | 目标实例 IP 地址 + 端口，默认空字符串 | 否 |
| `--header` | 请求头，格式 `key:value`（可重复） | 否 |
| `--body` | 请求体 JSON 字符串 | 否 |
| `--body-file` | 请求体文件路径 | 否 |
| `--request-timeout` | 请求超时毫秒，默认 60000 | 否 |
| `--protocol` | 协议，默认 http | 否 |

### http-call 返回字段

| 字段 | 说明 |
|------|------|
| `psm` | 服务 PSM |
| `http_method` | HTTP 方法 |
| `http_path` | HTTP 路径 |
| `env` | 环境 |
| `zone` | 区域 |
| `idc` | IDC |
| `cluster` | 集群 |
| `protocol` | 协议 |
| `data` | 响应数据 |
| `resp_body_json` | 响应体 JSON（如果可解析） |
| `resp_body_string` | 响应体字符串（如果不可解析为 JSON） |

## 3. rpc-call - RPC 调用

```bash
# 使用 BAM IDL 版本调用（推荐）
bytedcli api-test rpc-call "inf.hae.boe" "GetUser" --idl-version "1.0.68" --env prod --idc lf --body '{}'

# 使用 branch ref 调用
bytedcli api-test rpc-call "inf.hae.boe" "GetUser" --idl-version "main" --idl-source branch --env prod --idc lf --body '{}'

# 指定 zone、cluster 和 control-plane
bytedcli api-test rpc-call "inf.hae.boe" "GetUser" --idl-version "1.0.68" --zone BOE --idc lf --env prod --cluster default --control-plane "China-online" --body '{"id":123}'

# 指定目标实例地址
bytedcli api-test rpc-call "inf.hae.boe" "GetUser" --idl-version "1.0.68" --env prod --idc lf --body '{}' --address "127.0.0.1:8080"

# 使用 body-file
bytedcli api-test rpc-call "inf.hae.boe" "GetUser" --idl-version "1.0.68" --env prod --idc lf --body-file /tmp/request.json

# 非 JSON 模式输出带上 log_id
bytedcli api-test rpc-call "inf.hae.boe" "GetUser" --idl-version "1.0.68" --env prod --idc lf --body '{}' --with-logid

# JSON 模式输出
bytedcli --json api-test rpc-call "inf.hae.boe" "GetUser" --idl-version "1.0.68" --env prod --idc lf --body '{}'
```

### rpc-call 参数说明

| 参数 | 说明 | 必填 |
|------|------|------|
| `[psm]` | 服务 PSM | 是 |
| `[method]` | 方法名称 | 是 |
| `--idl-version` | IDL 版本（BAM 版本号或 MR 分支名） | 是 |
| `--env` | 环境 | 是 |
| `--idc` | 服务部署 IDC，如 `lf/my/sg` | 是 |
| `--idl-source` | IDL 来源：`branch`（默认）或 `bam`，默认从 `--idl-version` 推断 | 否 |
| `--zone` | 区域，默认 CN | 否 |
| `--cluster` | 集群，默认 default | 否 |
| `--control-plane` | 控制平面（可选） | 否 |
| `--address` | 目标实例地址（可选，不传则由平台自动路由） | 否 |
| `--body` | 请求体 JSON 字符串 | 否 |
| `--body-file` | 请求体文件路径 | 否 |
| `--request-timeout` | 请求超时毫秒，默认 60000 | 否 |
| `--connect-timeout` | 连接超时毫秒，默认 60000 | 否 |
| `--with-logid` | 非 JSON 模式下先输出 `log_id: xxx` 再输出 resp_body（默认 false） | 否 |

### rpc-call 返回字段

| 字段 | 说明 |
|------|------|
| `psm` | 服务 PSM |
| `method` | 方法名称 |
| `idl_version` | IDL 版本 |
| `idl_source` | IDL 来源（1=branch，2=bam） |
| `zone` | 区域 |
| `idc` | IDC |
| `env` | 环境 |
| `cluster` | 集群 |
| `control_plane` | 控制平面 |
| `address` | 目标实例地址 |
| `data` | 响应数据 |
| `resp_body_json` | 响应体 JSON（如果可解析） |
| `resp_body_string` | 响应体字符串（如果不可解析为 JSON） |

### IDL 版本推断规则

- 如果 `--idl-version` 符合 `X.Y.Z` 格式（如 `1.0.68`），自动推断为 `bam`（idl_source=2）
- 否则推断为 `branch`（idl_source=1）
- 可以通过 `--idl-source` 显式指定覆盖推断结果

## 4. gen-request - 生成请求参数示例

根据 IDL 生成请求参数的示例代码，支持 RPC 和 HTTP 协议。通过 SSE 流式返回逐步构建的请求参数。

```bash
# 使用 BAM IDL 版本生成请求参数
bytedcli api-test gen-request --psm "inf.hae.boe" --protocol rpc --function-name "DeleteApiV3BoeDevice" --idl-source 2 --idl-version "1.0.1162"

# 使用 codebase 分支生成请求参数
bytedcli api-test gen-request --psm "inf.hae.boe" --protocol rpc --function-name "DeleteApiV3BoeDevice" --idl-source 1 --idl-version "master"

# 指定环境
bytedcli api-test gen-request --psm "inf.hae.boe" --protocol rpc --function-name "DeleteApiV3BoeDevice" --idl-source 2 --idl-version "1.0.1162" --env prod

# JSON 模式输出
bytedcli --json api-test gen-request --psm "inf.hae.boe" --protocol rpc --function-name "DeleteApiV3BoeDevice" --idl-source 2 --idl-version "1.0.1162"
```

### gen-request 参数说明

| 参数 | 说明 | 必填 |
|------|------|------|
| `--psm` | PSM 名称，如 `inf.hae.boe` | 是 |
| `--protocol` | 协议类型，如 `rpc` 或 `http` | 是 |
| `--function-name` | 函数/方法名称 | 是 |
| `--idl-source` | IDL 来源：`1` 表示 codebase（需要 MR 分支名），`2` 表示 BAM（需要 IDL 版本号） | 是 |
| `--idl-version` | 当 `idl-source=1` 时为 MR 分支名称；当 `idl-source=2` 时为 BAM IDL 版本号 | 是 |
| `--env` | 环境，如 `prod`（可选） | 否 |
| `--query` | Query JSON 字符串（可选，默认 `{}`） | 否 |
| `--body` | Body JSON 字符串（可选，默认 `{}`） | 否 |
| `--headers` | Headers JSON 字符串（可选，默认 `{}`） | 否 |
| `--cookies` | Cookies JSON 字符串（可选，默认 `{}`） | 否 |
| `--generate-source` | 生成来源（可选，默认 1） | 否 |
| `--generate-method` | 生成方法（可选，默认 1） | 否 |

### gen-request 返回字段

| 字段 | 说明 |
|------|------|
| `psm` | 服务 PSM |
| `protocol` | 协议类型 |
| `function_name` | 函数名称 |
| `idl_source` | IDL 来源（1=codebase，2=bam） |
| `idl_version` | IDL 版本 |
| `env` | 环境 |
| `query` | 生成的 query 参数（JSON 字符串） |
| `body` | 生成的 body 参数（JSON 字符串） |

### gen-request 输出说明

- 命令使用 SSE 流式输出，在终端逐步显示生成的请求参数
- 每条事件同时包含 `query` 和 `body`，body 内容逐步构建
- 最终 JSON 输出包含完整的 query 和 body 字符串
