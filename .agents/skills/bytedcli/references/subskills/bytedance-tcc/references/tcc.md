# TCC

```bash
bytedcli tcc site list
bytedcli --site cn tcc namespace list --page 1 --size 50
bytedcli --site cn tcc namespace search "keyword" --scope all --page 1 --size 50

bytedcli tcc config list "namespace" --region CN --keyword "demo" --dir-path "/default"
bytedcli tcc config get "namespace" "config_name" --region CN --dir "/default"
bytedcli tcc config get "namespace" "config_name" --region CN --dir "/encrypt" --decrypt
bytedcli tcc config version list "namespace" "config_name" --region CN --dir "/default"
bytedcli tcc config version get "namespace" "config_name" --ver 3 --region CN --dir "/default"
bytedcli --site i18n-bd tcc config dir list "namespace" --env ppe_xxx
bytedcli --site i18n-bd tcc config meta list --env ppe_xxx

bytedcli --site cn tcc config create "namespace" "config_name" --env ppe --region CN --dir "/default" --description "demo config" --value "a: b"
bytedcli --site cn tcc config update "namespace" "config_name" --env ppe --region CN --value "a: b"
# When the config belongs to a synced region group (for example CN + China-East),
# config update automatically expands extend_regions and update_base_version to all existing copies in that group.
bytedcli --site i18n-bd tcc config import "namespace" --config-ids "123,456" --target-env ppe_xxx

# config create requires a non-empty --description and automatically falls back
# to the V2 service_id create API for former_tcc / tcc_v2 namespaces.
# config update also falls back to the V2 service_id upsert API for
# former_tcc / tcc_v2 namespaces, using the requested --region and --dir.
# deployment deploy also switches former_tcc / tcc_v2 namespaces to the TCC AG V2
# deploy path: config/upsert_deploy/v2 + deployment/list/base_info/step_info/operate.
# For unpublished former_tcc configs, V2 deploy expects the target latest version in region_confspace_version[].from_version, and remark should be written to config_data.note.
# In auto mode it reads the live current step before each operation and keeps
# advancing with the allowed forward action (for example start, next_batch,
# finish) when no review is required; otherwise it returns the current review
# deployment for follow-up approval.
# When a deploy stage sets force_rolling=true, the web deploy payload also turns
# on enable_rolling=true for that stage.
# Feature strategy env validation: when strategy_type=feature, --env must be
# ppe/ppe_* or boe/boe_* (e.g. ppe_demo, boe_demo).

# Deploy config (default: --publish-mode auto, auto start + finish when no review needed)
bytedcli --site cn tcc deployment deploy "namespace" "config_name" --env ppe --region CN --dir-path "/default"
# deployment deploy supports --dir-path to pin a same-name config inside a specific directory.
# When the config belongs to a synced region group (for example CN + China-East),
# deployment deploy automatically expands config_changes/check_review conf_ids to all existing copies in that group.
# Add --region-parallel when you need parallel rollout across regions.

# Only create deployment, do not start (manual mode)
bytedcli --site cn tcc deployment deploy "namespace" "config_name" --env ppe --region CN --dir-path "/default" --publish-mode manual

# Deploy with review support (auto mode): returns review info when review is needed
bytedcli --site cn tcc deployment deploy "namespace" "config_name" --env prod --region CN --dir-path "/default" --publish-mode auto

# Force auto-publish regardless of review requirement
bytedcli --site cn tcc deployment deploy "namespace" "config_name" --env prod --region CN --dir-path "/default" --publish-mode force-auto

# Query publish details by deployment ID or control-panel URL
bytedcli --site cn tcc deployment get "1234567890" --env prod
bytedcli tcc deployment get "https://example.com/tcc/namespace/demo.namespace/publish-details/1234567890??x-resource-account=demo&x-bc-region-id=example" --env prod

# Operate deployment or approve/reject current review step
bytedcli tcc deployment operate "1234567890" --operation start --env prod
bytedcli tcc deployment approve "https://example.com/tcc/namespace/demo.namespace/publish-details/1234567890??x-resource-account=demo&x-bc-region-id=example" --env prod
bytedcli tcc deployment reject "1234567890" --env prod
```
