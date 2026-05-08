# Yaegi 语法限制与可用库

脚本模板与 import 清单 → 参见 [`yaegi-template.md`](yaegi-template.md)。本文件只描述**可改区域**内的语法、特殊 API 与可用库。

## 脚本内特殊 API

### `feature.Value()`
获取其他特征的值。实体特征可引用该实体下全部特征;集内特征可引用该集合内全部特征 + 集合实体实例下全部特征(跨实体实例需前缀:`实体实例code.特征code`)。取值确定,可直接类型断言。

```yaegi
feat1Raw, err := feature.Value(ctx, "normalize_video_title")
if err != nil { return nil, err }
title := feat1Raw.(string)
```

### `entity.Param()`(仅实体特征)
```yaegi
tmp, _ := entity.Param(ctx, "user_id")
uid := tmp.(int64)
```

### `pkg.Param()`(仅生产集合特征)
```yaegi
tmp, _ := pkg.Param(ctx, "object_id")
objectID := tmp.(int64)
```

---

## 作用域速查

| API | 实体特征 | 集内特征 |
|---|---|---|
| `feature.Value` | ✅ | ✅ |
| `entity.Param` | ✅ | ❌ |
| `pkg.Param` | ❌ | ✅ |
| `ds.Cancel` | ✅ | ✅(仅请求脚本) |

---

## 可用库参考

### Go 标准库(与原生一致)
```go
"context" "encoding/hex" "errors" "fmt" "hash" "math" "math/rand"
"net/http" "regexp" "sort" "strconv" "strings" "time" "unicode/utf8"
```

### mapitf(`code.byted.org/contentlib/mapinterface`)
路径搜索 map/list,类 Python dict/list 语法糖。**包名是 `mapitf` 不是 `mapinterface`。**

| 入口 | 说明 |
|---|---|
| `mapitf.Fr(ctx, itf) MapInterface` | 从任意值创建 |
| `mapitf.From(itf) MapInterface` | 无 ctx 版本 |

MapInterface 核心方法:

| 方法 | 说明 |
|---|---|
| `Get(key)` | map 取值 |
| `GetAny(keys...)` | 逐层往下 |
| `Valid()` | 是否有效 |
| `Exist(key)` | `(v, bool)` |
| `Index(i)` | list 取下标 |
| `Uniq()` | 去重 |
| `ForEach(fn)` | 迭代 |

类型转换(忽略 err 返零值):`Val/ToStr/ToByte/ToInt/ToInt64/ToInt32/ToUint*/ToFloat32/ToFloat64/ToBool/ToRune`、`ToMap/ToMapInt/ToMapInt64/ToMapStrToStr/ToMapItf`、`ToList/ToListStr[F]/ToListInt[64]/ToListFloat32/64/ToListBool`。
类型检查:`IsStr/IsDigit/IsList/IsStrList/IsDigitList/IsMap/IsMapStrItf`。

示例:
```go
val, _ := mapitf.From(dsResp).GetAny("data", "list").Index(0).Get("name").ToStr()
is_story, _ := mapitf.From(extra).GetAny("is_story").ToInt64() // err 时 is_story=0
```

### cast(spf13/cast)
`cast.ToInt64E / ToBoolE / ToFloat64E / ToIntE / ToStringE`。

### slices
`Contains / Find / IndexOf / LastIndexOf / Reverse / Difference / Uniq / Sum / Compact / Filter / ToMap(arr, pivot) / ToSet`。

### maps
`Keys / Values / Difference(L, R) -> (leftOnly, rightOnly)`。

### sonic
`Marshal / MarshalString / Unmarshal / UnmarshalString / Get / GetFromString / Valid`,`sonic.Config{UseNumber:true, SortMapKeys:true}.Froze()` 可避免精度丢失。

### json(推荐用于精确解析)
`Marshal/MarshalString/Unmarshal/UnmarshalString`;
精确解析(避免精度丢失):`Get / GetString / GetInt / GetFloat / GetBoolean / GetUnsafeString`;
`ValueType`:`NotExist / String / Number / Object / Array / Boolean / Null / Unknown`;
数组下标:`"[0]"`、`"[1]"`;
`ParseBoolean/ParseString/ParseFloat/ParseInt`。

示例:
```go
data := []byte(`{"avatars":[{"url":"https://example.com"}]}`)
url, _ := json.GetString(data, "avatars", "[0]", "url")
```

### utils
`JsonParseComplex(str, jsonPath, value.Type)`、`HashMod / ListAverage / ListContainsList / ListDifference / ListExistIntersection / ListIntersectionDedup / ListMaxElement / StrHitListCount / TryConvertTo / HashStr / Base64Encode / Base64Decode`。

`value.Type` 常量(用于 JsonParseComplex/TryConvertTo):`Bool / Int / Float / String / List / IntList / FloatList / StringList / BoolList / Map / IntMap / FloatMap / StringMap / BoolMap`。

### sdk
| 函数 | 说明 |
|---|---|
| `sdk.GetConfigByNameWithCluster(name, cluster)` | KMS 读取配置 |
| `sdk.SignRpcRequest(ctx, ak, sk, method, caller, extra)` | IAM RPC 签名 |
| `sdk.MGetImageXURLV2(ctx, images, params)` | URI → URL(批量) |
| `sdk.MGetURIFromImageXURL(ctx, urls)` | URL → URI(批量) |
| `sdk.PackImageURL(ctx, uri, appID)` | URI → URL(单) |
| `sdk.PackImageURLWithExpire(...)` | 带过期 |
| `sdk.IsCicadaForbidAppeal(ctx, req)` | 蝉鸣封禁申诉 |
| `sdk.ConvertGaussMGetRequest / ConvertGaussMGetProfileRequest / ConvertGaussFeaturePB` | Gauss 辅助 |
| `sdk.GetMetaPersistentValue(ctx, key)` | RPC metainfo |

### ds
`ds.Cancel()`:在数据源请求脚本中跳过 RPC 调用。

### logs
`logs.CtxInfo / CtxWarn / CtxError`(输出到测算结果 JSON 代码栏)。

---

## 值类型(value_type 枚举)

用于:特征值类型、实体参数类型、生产集合参数类型、`feature test` 的 `type` 字段。

| 值 | 类型 |
|---|---|
| 1 | bool |
| 2 | int64 |
| 3 | float64 |
| 4 | string |
| 10 | []any |
| 11 | []bool |
| 12 | []int64 |
| 13 | []float64 |
| 14 | []string |
| 20 | map[string]any |
| 21 | map[string]bool |
| 22 | map[string]int64 |
| 23 | map[string]float64 |
| 24 | map[string]string |
