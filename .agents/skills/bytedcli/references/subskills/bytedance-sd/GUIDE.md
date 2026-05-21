---
name: bytedance-sd
description: "Use bytedcli sd to query ByteSD service discovery data. Covers sd list-sites, sd lookup by service PSM and VDC, and sd report by host and VDC. This is ByteSD, not SPD."
---

# bytedcli ByteSD

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

- 需要按服务 PSM 和 VDC 查询 ByteSD 注册实例。
- 需要按 host 和 VDC 查询某个节点上的 ByteSD 服务列表。
- 需要查看 ByteSD 支持的站点、TTP pilot 路由或与 TCE VRegion 的对齐关系。
- 用户提到 ByteSD、sd list-sites、sd lookup、sd report、服务发现实例或节点服务报告。

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要 ByteCloud 登录态；未登录时先执行 `bytedcli auth login`
- 这是 ByteSD 的 `sd` 命令，不是 Security Privacy Data 的 `spd` 命令

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 查看 ByteSD 站点路由与 TCE VRegion 元数据
bytedcli sd list-sites

# 按服务 PSM 查询 ByteSD endpoint
bytedcli sd lookup --psm demo.service --vdc demo-vdc

# 按 host 关键字过滤 lookup 结果
bytedcli --json sd lookup --psm demo.service --vdc demo-vdc --search 192.0.2

# 查询节点上的服务列表
bytedcli sd report --host 192.0.2.10 --vdc demo-vdc

# 查询节点上的指定服务
bytedcli --json sd report --host 2001:db8::10 --vdc demo-vdc --psm demo.service
```

## Agent Guidance

- `sd list-sites` 不需要业务参数；用于确认 ByteSD route、API base、JWT host，以及 TTP VDC 自动路由规则。JSON 输出包含 `sites` 与 best-effort 的 `tce_platform_sites`。
- `sd lookup` 必填 `--psm` 与 `--vdc`，可选 `--search` 过滤 host 关键字。
- `sd report` 必填 `--host` 与 `--vdc`，可选 `--psm` 过滤服务名。
- ByteSD API 只需要站点、VDC 与业务入参；控制台 URL 里的 `x-resource-account`、`x-bc-region-id`、`x-bc-vregion` 不需要同步到 CLI。
- ByteSD 的 `--vdc` 与 TCE 的 vregion/vdc 口径对齐；常见映射包括 `tx-ttp` 的 `useast5/useast8`，以及 `eu-ttp` 的 `no1a`、`ie/iedt/dedt`、`de`、`ie2`、`useast2a/useast2b`。
- EU TTP 场景使用全局 `--site eu-ttp`；CLI 会自动走 ByteSD 的 EU TTP pilot endpoint，此 endpoint 不需要额外传 ByteCloud routing 参数。
- US TTP 场景使用全局 `--site us-ttp`（`us-ttp-bdee` / `us-ttp-usts` 也可）；常见 VDC 包括 `useast5`、`useast8`，CLI 会自动走 ByteSD 的 US TTP pilot endpoint。
- 从 `--site i18n-tt` 查询上述 TTP VDC 时，CLI 会按 VDC 自动切到对应 pilot endpoint；`awsfr`、`be1a`、`fr1a`、`gcppl` 等 TCE i18n VDC 仍走 ROW ByteCloud 路径。如果用户已经知道是 TTP 控制面，优先显式传 `--site eu-ttp` 或 `--site us-ttp`。
- JSON 模式下，`lookup` 返回 `endpoints`，`report` 返回 `services`。
- 示例中使用的 `demo.service`、`demo-vdc`、`192.0.2.10` 和 `2001:db8::10` 都是占位值。
