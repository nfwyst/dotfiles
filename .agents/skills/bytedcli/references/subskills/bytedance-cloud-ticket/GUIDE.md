---
name: bytedance-cloud-ticket
description: "Operate Cloud Ticket workflow tickets: pending approvals, created by me, all tickets with filters/time ranges, and approve workflow transitions."
---

# Cloud Ticket（bytedcli）

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

- 查询待我审批的工单
- 查询我发起的工单
- 查询全部工单并按条件过滤（ID/关键字/状态/申请人/时间范围）
- 对工单执行“通过/流转”操作（approve）

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要鉴权的命令先登录：`bytedcli auth login`

## Quick start

```bash
# 站点/环境列表（best-effort）
bytedcli cloud-ticket list-sites

# 待我审批（默认最近 3 个月）
bytedcli cloud-ticket list-pending-approval

# 我发起的
bytedcli cloud-ticket list-created

# 全部
bytedcli cloud-ticket list-all

# 通过工单（自动选择 next）
bytedcli cloud-ticket approve --ticket-id 98045537

# 通过链式审批（同一审批人可继续时自动跟进）
# 说明：一次 approve 后如果你仍是下一节点的可审批人，可再次执行 approve。
# 判断方法：先执行 cloud-ticket list-all（或 list-pending-approval）确认工单仍在待办，
# 且下一步可执行操作可见 next；再重复执行 cloud-ticket approve。
# 连续通过时无需复杂脚本，按人工/脚本循环“approve + 查询状态”即可。
```

## Notes

- 默认时间范围为最近 3 个月，可用 `--start/--end/--range` 覆盖
- 使用全局 `--site` 选择站点（`cn|boe|boei18n|i18n|i18n-row`）；`boei18n` 对应 `cloud-boei18n.bytedance.net`（BOE 国际测试，需 ByteDance SSO），`i18n-row` 对应 `cloud.tiktok-row.net`（TikTok ROW，需先以 `BYTEDCLI_CLOUD_SITE=i18n-tt` 登录 TikTok SSO）。Per-service `--cloud-ticket-site` is a hidden alias for backward compatibility.
- 需要结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json cloud-ticket get ...`）

## References

- `references/cloud_ticket.md`
