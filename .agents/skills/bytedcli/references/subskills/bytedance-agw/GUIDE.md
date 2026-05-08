---
name: bytedance-agw
description: "Operate AGW (API Gateway) via bytedcli: search/view products, search services by PSM/path, register env/environment for BOE/PPE feature lanes, update IDL and publish to BOE/PPE environments, sync routes from IDL annotations. Use when tasks mention AGW, API Gateway, gateway product, gateway service, register env, register environment, IDL update, route sync, or gateway publish."
---

# bytedcli AGW

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

- AGW 产品搜索、收藏产品列表、产品详情查看
- AGW 服务搜索（按 PSM、路径等关键词）
- AGW 泳道环境注册（BOE/PPE feature env 首次使用前注册）
- AGW IDL 更新与发布（BOE/PPE 环境）
- AGW IDL + 路由同步更新（自动从 IDL 注解补齐缺失路由）

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要鉴权的命令先登录：`bytedcli auth login`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

Commands are grouped under `agw product`, `agw service`, `agw env`, and `agw idl`. Old flat names (e.g. `agw list-starred-product`, `agw search-service`, `agw register-env`, `agw update-idl`) still work as hidden aliases.

```bash
# 收藏产品列表
bytedcli agw product list

# 搜索产品
bytedcli agw product search --keyword "api"

# 产品详情
bytedcli agw product get --product "my-product"

# 搜索服务（按 PSM / 路径关键词）
bytedcli agw service search --input "codebase.app"

# 注册泳道环境（首次使用前）
bytedcli agw env register --service-id 12345 --type boe_feature --name boe_demo_lane

# 注册泳道环境并启用自动部署
bytedcli agw env register --service-id 12345 --type boe_feature --name boe_demo --auto-deploy --branch feat/example

# 更新 IDL 并自动发布
bytedcli agw idl update --service-id 12345 --env boe_default

# 更新 IDL 同时自动从 IDL 注解同步路由
bytedcli agw idl update --with-router --service-id 12345 --env boe_default
```

## Notes

- 需要结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json agw product search --keyword "api"`）
- `env register` 用于首次使用泳道环境前注册；重复注册会报错但无副作用；`--type` 常用值 `boe_feature`；默认不自动部署，传 `--auto-deploy --branch` 可启用自动部署并绑定 IDL 分支
- `idl update` 的 `--env` 仅支持 BOE（`boe_xxx`）和 PPE（`ppe_xxx`）环境
- `idl update` 的 `--publish-mode` 支持 `auto`（默认，自动发布并轮询结果）和 `manual`（仅更新 IDL 不发布）
- `idl update --with-router` 在 `idl update` 基础上自动解析 IDL 中的 `api.get`/`api.post` 等 Thrift 注解，将缺失的路由补齐到 AGW 配置的 `routes` 中（只增不删）
- 缺少必填参数会自动输出帮助信息

## References

- `references/agw.md`
