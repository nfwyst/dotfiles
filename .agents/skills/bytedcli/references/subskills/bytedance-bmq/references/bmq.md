# BMQ

```bash
# Topic 列表
bytedcli bmq topic list --vregion "US-BOE" --page 1 --size 20
bytedcli bmq topic list --vregion "Singapore-Central" --search "pipo" --all

# Topic 详情
bytedcli bmq topic get 12345 --vregion "US-BOE"

# Cluster 列表
bytedcli bmq cluster list --vregion "US-BOE" --all
bytedcli bmq cluster list --vregion "Singapore-Central" --search "public"

# Consumer Group 列表
bytedcli bmq consumer list --vregion "US-BOE" --page 1 --size 20
bytedcli bmq consumer list --vregion "Singapore-Central" --search "data_inventory" --all

# Mirror 列表
bytedcli bmq mirror list --vregion "Singapore-Central" --status RUNNING --all
bytedcli bmq mirror list --vregion "Singapore-Central" --search "topic_name" --size 10

# 多站点（TikTok ROW）
bytedcli --site i18n-tt bmq topic list --vregion "Singapore-Central" --all
```
