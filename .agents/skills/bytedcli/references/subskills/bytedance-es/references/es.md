# ES 命令参考

> 统一使用内部源 npx 调用：`references/invocation.md`

## 命令

### 1) es search

执行 ES 查询。

```bash
bytedcli es search \
  --psm byte.es.kefu_data_center \
  --index kefu_incoming_ivr \
  --method POST \
  --idc hl \
  --query '{"query":{"match_all":{}}}'

bytedcli --site i18n-tt es search \
  --psm byte.es.kefu_data_center \
  --index kefu_incoming_ivr \
  --idc my \
  --query '{"query":{"match_all":{}}}'

bytedcli --site boe es search \
  --psm byte.es.demo_psm \
  --index demo-index \
  --idc boe \
  --query '{"query":{"match_all":{}}}'
```

`es search` 的 Kibana host 跟随全局 `--site`：默认请求 `https://kibana-bytees.bytedance.net`，`--site i18n-tt` 时自动切到 `https://kibana-bytees-i18n.tiktok-row.net`，`--site boe` 时自动切到 `https://kibana-bytees-boe.bytedance.net`。未显式传 `--idc` 时默认使用 `hl`，`--site i18n-tt` 时默认 `idc` 改为 `my`，`--site boe` 时默认 `idc` 改为 `boe`。

**认证方式**：cn 站点使用 doas GDPR token；`--site i18n-tt` 使用 SSO cookie 认证（BDSSO CAS），需先执行 `bytedcli auth login --session` 完成 SSO 扫码登录。SSO cookie 失败时自动回退到 GDPR token。

### 参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| `--psm` | 是 | Kibana 实例 PSM 标识（如 `byte.es.kefu_data_center`） |
| `--index` | 是 | ES 索引名称 |
| `--query` | 是 | ES DSL 查询 JSON 字符串 |
| `--method` | 否 | Kibana Console proxy 的 HTTP 方法；默认 `GET`，推荐使用 `GET`、`POST`、`PUT`、`HEAD` |
| `--idc` | 否 | 机房标识，用于选择 Kibana 路径段（如 `hl`、`my`、`boe`；默认 `hl`，`--site i18n-tt` 时默认 `my`） |
| `--size` | 否 | 返回文档数量 |
| `--from` | 否 | 分页偏移量 |
| `--output` | 否 | 输出模式：`console`（默认）或 `file` |
| `--output-file` | 否 | 输出文件路径（默认：`es-search-{psm}-{index}-{timestamp}.json`） |

### 查询示例

```json
{
  "query": {
    "terms": {
      "sub_channel_id": [
        "C2LFZZ202602251454577D0367B3EDC6A66B",
        "C2LFZZ2026022515012974ED38440EA648D8"
      ]
    }
  }
}
```

```json
{
  "query": {
    "bool": {
      "must": [
        { "match": { "status": "success" } }
      ],
      "filter": [
        { "range": { "timestamp": { "gte": "2026-01-01", "lte": "2026-01-31" } } }
      ]
    }
  },
  "sort": [{ "timestamp": "desc" }],
  "size": 100
}
```
