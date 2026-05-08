# Yaegi 脚本模板(单一事实源)

本 Skill 中三类脚本(**脚本特征** / **数据源请求脚本** / **数据源结果脚本**)都基于下述同一框架,**只允许修改 `/*----------start----------*/` 与 `/*----------end----------*/` 之间的片段**。

## 完整模板

```yaegi
package processor

import (
	"context"
	"encoding/hex"
	"crypto/aes"
	"crypto/cipher"
	"crypto/md5"
	"encoding/base64"
	"errors"
	"fmt"
	"hash"
	"math"
	"math/rand"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
	"github.com/bytedance/sonic"
	"code.byted.org/contentlib/mapinterface"
	"code.byted.org/ies_safety/puzzle_common/yaegi/engine/module/entity"
	"code.byted.org/ies_safety/puzzle_common/yaegi/engine/module/feature"
	"code.byted.org/ies_safety/puzzle_common/yaegi/engine/module/logs"
	"code.byted.org/ies_safety/puzzle_common/yaegi/engine/module/pkg"
	"code.byted.org/ies_safety/puzzle_common/yaegi/engine/module/ds"

	"puzzle/sdk"
	"puzzle/utils"
	"puzzle/utils/maps"
	"puzzle/utils/cast"
	"puzzle/utils/json"
	"puzzle/utils/value"
	"puzzle/utils/slices"
)

func Process(ctx context.Context, input map[string]any) (res map[string]any, err error) {
    /*----------start----------*/


    /*----------end----------*/
}
```

## 数据源结果脚本的 Process 头部(差异)

除模板外,结果脚本的 Process 体**起始**固定为:

```yaegi
func Process(ctx context.Context, input map[string]any) (res map[string]any, err error) {
    // 获取RPC数据源返回结果
    dsReq := input["dsReq"].(map[string]any)
    dsResp := input["dsResp"].(map[string]any)
    dsErr := input["dsErr"]
    /*----------start----------*/
	if dsErr != nil {
		return nil, dsErr.(error)
	}


    /*----------end----------*/
}
```

其中:
- `dsReq`:RPC 请求参数
- `dsResp`:RPC 响应参数(主要取值来源)
- `dsErr`:RPC 错误

## Process 返回值约定

| 脚本类型 | 返回 `map[string]any` 的 key |
|---|---|
| 脚本特征 | **特征 code** |
| 数据源请求脚本 | 对齐数据源 schema(构造 RPC body) |
| 数据源结果脚本 | **特征 code** |

## 强约束
- 结束标记 `/*----------end----------*/` **前必须独立换行**,不能与代码写同一行。
- `import` 块禁止新增/删除,非白名单包不可用(见 yaegi-syntax.md)。
