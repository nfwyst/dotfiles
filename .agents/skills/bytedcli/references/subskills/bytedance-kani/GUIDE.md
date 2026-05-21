---
name: bytedance-kani
description: "Skill for Kani 权限审批。Use when tasks mention Kani、权限申请/审批、work order、approval list、protego/kani_*."
---

# Kani 权限审批

## 如何调用

```bash
# 方式 1：直接用 npx 运行最新版
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]

# 方式 2：先全局安装，再直接调用 bytedcli
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli <command> [options]
```

## When to use

- 需要查询/跟踪 Kani 权限审批工单（我发起的/待我审批的/已完成的）
- 需要按状态、审批角色（applicant/reviewer）、是否加急等维度筛选

## 前置条件

- 需要鉴权，先登录：`bytedcli auth login --session`

## 常用命令

```bash
# 查看帮助
bytedcli kani --help

# 列出审批工单（默认尽量贴近 Kani request 页语义）
bytedcli kani approval list

# 查看待我审批（reviewer 视角）
bytedcli kani approval list --role reviewer

# 查看我发起的、已完成的申请
bytedcli kani approval list --role applicant --view finished

# 过滤：指定申请人 / 审批人
bytedcli kani approval list --applicant alice --reviewer bob

# 过滤：加急 bucket（true/false）
bytedcli kani approval list --urgent true

# 过滤：命名空间 / 安全等级 / VDC
bytedcli kani approval list --ns demo_ns --security-level P0 --vdc demo_vdc

# 过滤：时间范围（ISO,ISO）
bytedcli kani approval list --created-at 2026-05-01T00:00:00Z,2026-05-12T00:00:00Z

# 分页
bytedcli kani approval list --urgent true --limit 50 --offset 0

# 机器可读输出（全局参数，必须放在子命令前）
bytedcli --json kani approval list
```

## 参数一览（kani approval list）

> 以 `bytedcli kani approval list --help` 为准，这里按当前实现做摘要。

- `--role <role>`：`applicant|reviewer`（默认 `applicant`）
- `--view <view>`：`running|finished`（默认 `running`）
- `--applicant <user>`：申请人过滤
- `--reviewer <user>`：审批人过滤
- `--status <status>`：工单状态过滤
- `--review-status <status>`：审批状态过滤
- `--urgent <boolean>`：加急 bucket 过滤（`true|false`）
- `--vdc <vdc>`：VDC 过滤
- `--limit <n>`：单 bucket page size（默认 `20`）
- `--offset <n>`：单 bucket offset
- `--start-id <id>`：单 bucket pagination start_id
- `--created-at <startISO,endISO>`：创建时间范围
- `--review-created-at <startISO,endISO>`：审批创建时间范围
- `--asc <boolean>`：是否升序
- `--cross-region <boolean>`：跨 region 过滤
- `--ns <ns>`：命名空间过滤
- `--security-level <level>`：安全等级过滤
- `--kani-site <site>`：隐藏参数，`cn|boe`（默认 `cn`）

## Notes

- `--json` 是全局参数，必须放在子命令前，例如：`bytedcli --json kani approval list`
- 若你在 BOE 环境排查，可使用隐藏参数：`--kani-site boe`（默认 `cn`）

## References

- `references/kani.md`
- `references/troubleshooting.md`
