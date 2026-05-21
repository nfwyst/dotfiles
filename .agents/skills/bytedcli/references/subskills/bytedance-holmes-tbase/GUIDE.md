---
name: bytedance-holmes-tbase
description: "Query Holmes TBase product metadata, runtime config, field metadata, triggers, row data, and create field review tickets via bytedcli. Use when tasks mention Holmes TBase、TBase、row key、查字段、新增字段、创建字段、product get、config get、field list、field add、field describe、field get、trigger list、全量字段查询、多字段查询."
---

# bytedcli Holmes TBase

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

- 查询指定 TBase 产品的完整详情（`holmes tbase product get`）
- 查询指定 TBase 产品的运行配置（`holmes tbase config get`）
- 列出指定 TBase 产品的字段列表（`holmes tbase field list`）
- 列出指定 TBase 产品的 Trigger 列表（`holmes tbase trigger list`）
- 获取单个字段元信息列表行（`holmes tbase field describe`）
- 创建字段新增提审工单（`holmes tbase field add`）
- 按 row key 查询单字段、多字段或整行全部字段值（`holmes tbase field get`）

## 前置条件

- Holmes TBase 依赖 Holmes BDSSO CAS 认证。首次使用前先执行：`bytedcli auth login --session`
- 结构化输出使用 `--json`，并且它是全局参数，必须放在 `holmes` 之前
- TBase 命令都要求显式传 `--region`，当前支持：`cn`、`sg`、`va`、`ttp`、`gcp`

## Quick start

```bash
# 查询产品详情
bytedcli holmes tbase product get --produce-name example.tbase.demo --region sg

# 查询产品运行配置
bytedcli holmes tbase config get --produce-name example.tbase.demo --region sg

# 列字段列表
bytedcli holmes tbase field list --produce-name example.tbase.demo --region sg

# 按字段名筛选字段
bytedcli holmes tbase field list --produce-name example.tbase.demo --region sg --keyword activity

# 只看 trigger 字段
bytedcli holmes tbase field list --produce-name example.tbase.demo --region sg --only-trigger

# 列出 triggers
bytedcli holmes tbase trigger list --produce-name example.tbase.demo --region sg

# 获取单个字段元信息列表行
bytedcli holmes tbase field describe --produce-name example.tbase.demo --field-name activity_id --region sg

# 新增字段提审；默认 dry-run，不会提交
bytedcli holmes tbase field add --produce-name example.tbase.demo --region sg --from field.json

# 真正创建字段 review 工单
bytedcli holmes tbase field add --produce-name example.tbase.demo --region sg --body-json '{"field_name":"demo_field","field_type":"TYPE_STRING","field_version":"0","template_name":"demo_template","owner":"user.name","comments":"add demo field"}' --yes

# 查询单字段值
bytedcli holmes tbase field get --produce-name example.tbase.demo --field-name activity_id --row-key 1 --region sg

# 查询多字段值（显式版本）
bytedcli holmes tbase field get --produce-name example.tbase.demo --field activity_id:2 --field activity_ids:2 --row-key 1 --region sg

# 查询整行全部字段值
bytedcli holmes tbase field get --produce-name example.tbase.demo --all-fields --row-key 1 --region sg

# JSON 输出
bytedcli --json holmes tbase field get --produce-name example.tbase.demo --field-name activity_id --row-key 1 --region sg

# 覆盖默认读路由
bytedcli holmes tbase field get --produce-name example.tbase.demo --field-name activity_id --row-key 1 --region sg --psm example.psm --dc sg1 --cluster default
```

## 区域路由

- `--region` 是所有 Holmes TBase 命令的必填参数
- CLI 会根据 `--region` 选择对应的 Holmes TBase 访问路由
- `cn`、`sg`、`va`、`ttp`、`gcp` 可能存在同名产品，因此查询时始终要带正确 region
- 常规使用只需要传 `--region`；不需要手工指定 base URL

## Authentication

Holmes TBase 使用 BDSSO CAS 认证。首次使用前需要创建 SSO browser session：

```bash
bytedcli auth login --session
```

扫码完成后，后续 Holmes TBase 命令会自动复用 SSO session。也可以通过 `BYTEDCLI_HOLMES_COOKIE` 环境变量注入 Holmes cookie。

## Notes

- 参数名是 `--produce-name`，不是 `--product-name`
- `field describe` 只返回字段列表中的单条记录，不会拉取 scheme/diff detail
- `field add` 创建的是 Holmes review 工单，不会自动审批或上线；不加 `--yes` 时只 dry-run 并输出最终 payload
- `field add` 的 `--body-json` 与 `--from` 二选一；CLI 会自动补齐 `produce_id`、`resource_id`、`review_link`、`id=0`，提交成功后返回带 review id 的 `review_ticket_link`
- `field get` 支持三种主路径：
  - `--field-name <name>`
  - `--field <name[:version]>`
  - `--all-fields`
- 当字段存在多版本时，可以配合 `--field-version` 或直接使用 `--field name:version`
- `field list` 支持分页与筛选：`--page`、`--page-size`、`--keyword`、`--only-trigger`、`--template-name`
- 需要结构化输出时，记得把 `--json` 放在 `holmes` 之前

## References

- `src/cli/commands/holmes/index.ts`
- `skills/bytedance-holmes/SKILL.md`
- `skills/bytedance-holmes/references/holmes.md`
