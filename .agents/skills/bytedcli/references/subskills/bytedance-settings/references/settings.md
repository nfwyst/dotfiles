# Settings

```bash
bytedcli settings item get --item-id "123456"
bytedcli settings item create --id 1001 --item-name "sample_item" --brief "sample brief" --schema "{\"type\":\"integer\"}" --reviewers-json "[]"
bytedcli settings item create --id 1001 --item-name "sample_item" --brief "sample brief" --schema "1"
bytedcli settings item create --id 1001 --item-name "sample_item" --brief "sample brief" --schema "abc"
bytedcli settings item create --id 1001 --item-name "sample_item" --brief "sample brief" --schema "{}"
bytedcli settings item create --id 1001 --item-name "sample_item" --brief "sample brief" --schema "{\"s\":\"abc\"}"
bytedcli settings item create --id 1001 --item-name "sample_item" --brief "sample brief" --scheme "{}"
bytedcli settings draft save --item-id "123456" --code "return true" --draft-type 1 --next-step 1
bytedcli settings review list --item-id "123456"
bytedcli settings deploy list --item-id 123456 --page 1 --page-size 10
bytedcli settings whitelist add --item-id "123" --title "demo" --whitelist "u1"
bytedcli settings whitelist list --item-id "123" --page-size 10 --page 1 --status 0 --type 0 --keyword ""
bytedcli settings whitelist biz-get --whitelist-id 1001
bytedcli settings ut list --item-id 123456 --ut-status 0
bytedcli settings var list-item --item-id 123456
bytedcli settings biz search-id --appid "1001"
```
