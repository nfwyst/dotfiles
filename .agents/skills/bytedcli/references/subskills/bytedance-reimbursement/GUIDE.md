---
name: bytedance-reimbursement
description: "Use bytedcli reimbursement commands for reimbursement workflows backed by Hi Travel, including listing reimbursement forms, reading details, running pre-submit detection, deleting drafts, explicit submit, and preparing AI subscription reimbursement drafts from receipt files."
---

# bytedance-reimbursement

Use this skill when a task mentions Hi Travel, 报销, reimbursement, invoice/receipt attachment, or AI subscription reimbursement.

## Commands

```bash
# List and inspect reimbursement forms
bytedcli --json reimbursement list --page 1 --page-size 10
bytedcli --json reimbursement get --id <reimbursement_union_id>

# Run pre-submit detection
bytedcli --json reimbursement detect --id <reimbursement_union_id>

# Delete or close a draft after the user explicitly confirms the live action
bytedcli --json reimbursement delete --id <reimbursement_union_id> --yes

# Prepare an AI subscription reimbursement draft from a receipt
bytedcli --json reimbursement ai-subscription create \
  --receipt ./sample-receipt.png \
  --date 2026-05-07 \
  --invoice-amount 200 \
  --claim-ratio 0.5

# Submit only after the user explicitly confirms the live action
bytedcli --json reimbursement ai-subscription create \
  --receipt ./sample-receipt.png \
  --date 2026-05-07 \
  --invoice-amount 200 \
  --claim-ratio 0.5 \
  --submit \
  --yes
```

## Guidance

- Authentication resolves the Travel session in this order:
  1. bytedcli's local cache (refreshed within the past 6 hours).
  2. Chrome's persistent cookie store. When stdin/stdout are a TTY, bytedcli reads `TRAVEL_SESSION` for `travel.bytedance.com` from Chrome's local cookie SQLite store, decrypting via macOS Keychain `Chrome Safe Storage`. On first use the OS shows one Keychain prompt — click "Always Allow" once and the cookie is reused thereafter. Set `BYTEDCLI_DISABLE_CHROME_COOKIE_STORE=1` to skip this path.
  3. Chrome CDP. If a Chromium-based browser is running with `--remote-debugging-port` open (defaults probed: `9222`, `19825`; override via `BYTEDCLI_REIMBURSEMENT_CDP_PORT`), bytedcli reads the existing `TRAVEL_SESSION` over CDP without launching Chrome or touching Keychain. This path is the recommended primary in agent / CI / non-TTY environments and runs automatically when the cookie-store path is skipped.
  4. SSO redirect chain backed by `bytedcli auth login --session`. Kept as a last resort; the upstream Travel site is now a single-page app, so this path is rarely able to mint a fresh `TRAVEL_SESSION` by itself.
- Onboarding: open `https://bytedance.feishu.cn` → Workspace → Reimbursement in Chrome once a year so the mini-program login refreshes `TRAVEL_SESSION` in Chrome's cookie store. bytedcli reads it from there on subsequent runs.
- `ai-subscription create` defaults to preparing a draft/update and running detection; it does not submit unless both `--submit` and `--yes` are present.
- `reimbursement delete` also has the `close` alias and requires `--yes`; use it only for drafts that should be removed.
- Use `--template-reimbursement-id` when you want to clone stable AI expense fields from a prior successful form.
- Use `--reimbursement-id` when the draft already exists and only the receipt, invoice, amount, or expense row should be updated.
- `--invoice-amount` is the full receipt amount. The expense claim uses `--claim-ratio` and converts to CNY with the Travel exchange-rate API.
