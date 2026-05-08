# GetTestPlanMind API 响应结构

## 端点

`POST https://bytest.bytedance.net/caseApi/CaseService/GetTestPlanMind`

> 注意：域名是 `bytest.bytedance.net`，不是 `bits.bytedance.net`（后者是前端 SPA，会返回 HTML）。

## 必需 Headers

| Header | 值 | 说明 |
|--------|---|------|
| `content-type` | `application/json` | |
| `projectid` | 项目 ID（数字） | 如 `2020093641` |
| `service` | `CaseService` | 固定值 |
| `servicefunc` | `GetTestPlanMind` | 固定值 |
| `x-jwt-token` | ByteCloud JWT | 不是 SSO token，不是 `Authorization: Bearer` |
| `x-onesite-space-id` | Space ID | 从 URL `/devops/{spaceId}/` 解析 |
| `x-trigger-source` | `onesite` | 固定值 |

## 请求体

```json
{
  "ProductId": 2020093641,
  "TestPlanId": 13365830,
  "IgnoreCaseMind": false
}
```

- `IgnoreCaseMind: false` → 返回 `TestCaseMind`（脑图 JSON）+ `LeafInfo`
- `IgnoreCaseMind: true` → `TestCaseMind` 为空，仍返回 `LeafInfo`

## 响应体

```json
{
  "data": {
    "ProductId": 2020093641,
    "TestPlanId": 13365830,
    "TestCase": [
      {
        "TestCaseId": 13267846,
        "TestCaseTitle": "【AnyClaw】技能和工具",
        "TestCaseMind": "{脑图JSON字符串}"
      }
    ],
    "LeafInfo": {
      "13267846": {
        "yvspaoigrplmos": {
          "CaseId": 13267846,
          "Status": 1,
          "Priority": "2",
          "Text": "测试点预期结果描述",
          "Note": "备注（可能是 JSON 字符串）",
          "MinderId": "yvspaoigrplmos",
          "Label": "all",
          "Executor": {
            "UserKey": "username",
            "DisplayName": "显示名",
            "EnName": "English Name"
          }
        }
      }
    }
  }
}
```

## LeafInfo 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `Status` | number | `0`=未执行, `1`=通过, `2`=不通过, `3`=阻塞, `4`=跳过, `5`=回滚 |
| `Priority` | string | `"99"`=P0, `"1"`=P1, `"2"`=P2, `"3"`=P3, `"-1"`=未设置 |
| `Text` | string | 测试点的预期结果/验证内容 |
| `Note` | string | 备注，可能是纯文本或 `{"text":"...","images":[]}` JSON |
| `Executor` | object | 执行人，含 `UserKey`/`DisplayName`/`EnName` |
| `MinderId` | string | 脑图叶子节点 ID |

## TestCaseMind 脑图结构

`TestCaseMind` 是 JSON 字符串，解析后为树结构：

```json
{
  "data": {
    "id": "节点ID",
    "text": "节点文本",
    "priority": 0,
    "nodeType": 0
  },
  "children": [ ... ]
}
```

- `priority`: `0`=普通, `1`=P0, `2`=P1, `3`=P2, `99`=未分级
- `children` 可能为 `null`
- 空 `text` 节点跳过
