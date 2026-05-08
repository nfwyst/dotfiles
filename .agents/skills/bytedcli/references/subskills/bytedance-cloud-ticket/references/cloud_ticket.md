# Cloud Ticket（工单平台）

## 常用命令

```bash
# 列出支持的站点与 vregion（best-effort）
bytedcli cloud-ticket list-sites

# 待我审批（默认最近 3 个月）
bytedcli cloud-ticket list-pending-approval

# 我发起的
bytedcli cloud-ticket list-created

# 全部
bytedcli cloud-ticket list-all

# 通过工单（自动选择 next 操作）
bytedcli cloud-ticket approve --ticket-id 98045537

# 持续审批（同一审批人场景）
# 说明：若审批通过后仍由你继续审批，先看工单状态/可执行操作，再决定是否继续执行下一次 approve；
# 如果可执行操作仍有 `next`，说明可继续；否则停止（通常表示已进入执行/终态或其他审批人节点）。

# 手动指定操作参数
bytedcli cloud-ticket approve --ticket-id 98045537 --op-key next --status waiting_execute --current-status biz_reviewers_reviewing
```

## 过滤与时间范围

```bash
# 按工单 ID/关键字/状态/申请人过滤
bytedcli cloud-ticket list-pending-approval \
  --ticket-id 123 \
  --keyword "cert" \
  --status 1,2 \
  --applicant "alice"

# 指定最近 1 小时
bytedcli cloud-ticket list-created --range 1h

# 指定时间区间（支持时间戳/RFC3339）
bytedcli cloud-ticket list-all \
  --start 1700000000 --end 1700100000
```

## 站点切换

```bash
# BOE
bytedcli --site boe cloud-ticket list-created

# BOE-I18N（cloud-boei18n.bytedance.net，BOE 国际测试）
# 注意：使用 ByteDance SSO，可复用 cn/i18n 登录态
bytedcli --site boei18n cloud-ticket list-created
bytedcli --site boei18n cloud-ticket approve --ticket-id <id>

# I18N（cloud.byteintl.net，ByteIntl 国际站）
bytedcli --site i18n-bd cloud-ticket list-created

# I18N-ROW（cloud.tiktok-row.net，TikTok ROW 国际站）
# 注意：需先以 BYTEDCLI_CLOUD_SITE=i18n-tt 登录 TikTok SSO
BYTEDCLI_CLOUD_SITE=i18n-tt bytedcli auth login
bytedcli --site i18n-row cloud-ticket list-pending-approval
bytedcli --site i18n-row cloud-ticket approve --ticket-id <id>
```
