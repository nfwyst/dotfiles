# 其他常见问题与处理

## 1. 脚本编译:`undefined: xxx`
原因:引用了**未开放**的包或函数。
处理:
- 对照 `yaegi-syntax.md` 的**可用库**章节;非白名单一律不支持。
- 常见坑:包名是 `mapitf` 不是 `mapinterface`;没开放 `net/url`、`io/ioutil` 等。

## 2. 脚本编译:类型断言失败 / panic
- `entity.Param` / `pkg.Param` 的返回类型与**参数定义类型**一致,可直接断言;断言前确认 code 正确。
- `feature.Value` 同理,类型由**被引用特征的 value_type** 决定。
- 解析 JSON 数字避免 `json.Unmarshal`(会把大整数退化为 float64),改用 `json.GetInt/GetFloat` 或 `sonic.Config{UseNumber:true}`。

## 3. 创建数据源特征:`feat_value_type` 校验失败
- `ds_feature.feat_value_type` **必须为 20**(map)。
- `output_ds_features[*].feat_value_type` **必须等于实际输出特征类型**,不一定是 20(map)。

## 4. `feature test` 返回空 map / 全是默认值
- 检查 Process 返回的 key 是否为 **特征 code** 而非字段名。
- 检查 `default_value`:字符串类**必须**为 `""`,不是空。
- 检查 `output_features[*].status=2`(DevWithDraft)。

## 5. `feature test` 报参数缺失
- 实体多必填参数(如 `live_id` + `room_id`)必须**同时**提供。
- `--entity-params`(实体) / `--pkg-params`(集内)

## 6. `create-draft` 重复调用被拒
按 SKILL.md `0.5` 幂等规则:后续修改走 `get-rule-conf --load-draft` + `update-rule-conf`,**不要再 create-draft**。

## 7. `update-rule-conf` 报 version 冲突
`UpdateXxxReq.version` 必须等于最近一次 `GetXxxData.version`。修复:重新 `get-rule-conf --load-draft` 拿最新 version。

## 8. 大整数 ID 精度丢失
所有 ID 字段(feature_id / entity_id / collection_id / mm_feature_id / ds_id)在 JSON 中统一用**字符串**类型。
