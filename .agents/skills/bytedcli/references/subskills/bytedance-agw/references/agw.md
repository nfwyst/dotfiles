# AGW (API Gateway)

## 产品管理

```bash
# 收藏产品列表
bytedcli agw product list [--page <n>] [--page-size <n>]

# 搜索产品
bytedcli agw product search --keyword <keyword> [--page <n>] [--page-size <n>]

# 产品详情
bytedcli agw product get --product <product>
```

| 命令 | 参数 | 说明 |
|------|------|------|
| `product list` | `--page` | 页码（默认 1） |
| | `--page-size` | 每页条数（默认 20） |
| `product search` | `--keyword` | 搜索关键词（必填） |
| | `--page` | 页码（默认 1） |
| | `--page-size` | 每页条数（默认 20） |
| `product get` | `--product` | 产品名称（必填） |

## 服务搜索

```bash
bytedcli agw service search --input <keyword>
```

| 参数 | 说明 |
|------|------|
| `--input` | 搜索关键词，支持 PSM、路径等（必填） |

## 环境注册

```bash
bytedcli agw env register --service-id <id> --type <type> --name <name> [--auto-deploy] [--branch <branch>]
```

| 参数 | 说明 |
|------|------|
| `--service-id` | AGW 服务 ID（必填） |
| `--type` | 环境类型，如 `boe_feature`（必填） |
| `--name` | 环境名，如 `boe_wutingjia`（必填） |
| `--auto-deploy` | 启用自动部署（默认关闭，可选） |
| `--branch` | 绑定 IDL 分支，配合自动部署使用（可选） |

## IDL 更新与发布

```bash
bytedcli agw idl update --service-id <id> --env <env> [options]
```

| 参数 | 说明 |
|------|------|
| `--service-id` | AGW 服务 ID（必填） |
| `--env` | AGW 环境名，如 `boe_default`、`ppe_xxx`（必填） |
| `--bam-psm` | 覆盖 BAM PSM（默认从 AGW 配置推断） |
| `--bam-version` | 目标 BAM IDL 版本（默认最新） |
| `--branch` | 目标 git 分支（选取该分支上最新版本） |
| `--description` | 配置描述（默认 "bytedcli update idl"） |
| `--publish-mode` | 发布模式：`auto`（默认）/ `manual` |
| `--poll-interval-ms` | 自动发布后轮询间隔（默认 2000） |
| `--max-wait-ms` | 自动发布后最大等待时间（默认 30000） |

## IDL + 路由更新与发布

在更新 IDL 的同时，自动解析目标 IDL 中的 Thrift 路由注解（`api.get`、`api.post`、`api.put`、`api.delete`、`api.patch`），将缺失的路由补齐到 AGW 配置的 `routes` 数组中（只增不删）。

```bash
bytedcli agw idl update --service-id <id> --env <env> --with-router [options]
```

| 参数 | 说明 |
|------|------|
| `--service-id` | AGW 服务 ID（必填） |
| `--env` | AGW 环境名，如 `boe_default`、`ppe_xxx`（必填） |
| `--bam-psm` | 覆盖 BAM PSM（默认从 AGW 配置推断） |
| `--bam-version` | 目标 BAM IDL 版本（默认最新） |
| `--branch` | 目标 git 分支（选取该分支上最新版本） |
| `--description` | 配置描述（默认 "bytedcli update idl and router"） |
| `--publish-mode` | 发布模式：`auto`（默认）/ `manual` |
| `--poll-interval-ms` | 自动发布后轮询间隔（默认 2000） |
| `--max-wait-ms` | 自动发布后最大等待时间（默认 30000） |

与不带 `--with-router` 的区别：`--with-router` 会额外解析 IDL 中的路由注解并将新路由追加到配置中；已有路由不会被删除或修改。
