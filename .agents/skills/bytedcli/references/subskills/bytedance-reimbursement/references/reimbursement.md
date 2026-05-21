# Reimbursement Commands

Reimbursement commands are grouped under `reimbursement` and backed by Hi Travel APIs.
Authentication uses the Travel session cached by bytedcli first. If that cache is missing or expired, run `bytedcli auth login --session`; reimbursement commands exchange that stored SSO browser session for `travel.bytedance.com` cookies.

```bash
bytedcli auth login --session
bytedcli reimbursement auth logout
bytedcli --json reimbursement list --page 1 --page-size 10
bytedcli --json reimbursement get --id <reimbursement_union_id>
bytedcli --json reimbursement detect --id <reimbursement_union_id>
bytedcli --json reimbursement delete --id <reimbursement_union_id> --yes
bytedcli --json reimbursement submit --id <reimbursement_union_id> --yes
```

AI subscription reimbursement draft:

```bash
bytedcli --json reimbursement ai-subscription create \
  --receipt ./sample-receipt.png \
  --date 2026-05-07 \
  --invoice-amount 200 \
  --claim-ratio 0.5
```
