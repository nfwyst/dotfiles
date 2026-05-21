# Codecov 命令详解

## report create

最小输入 `--psm` + `--branch`：CLI 自动串 project_id / commit / author 再调用 `POST /api/v2/full/report/create`。

必填：`--psm`, `--branch`
常用可选：`--os-type server`（默认）, `--base-commit <7~64位>`, `--author-id`, `--tag`, `--env`, `--commit-list`

```bash
bytedcli codecov report create --psm example.service.api --branch master
bytedcli codecov report create --psm example.service.api --branch feat/x --os-type server --base-commit 0000000aaaa
```

## report create-incr

最小输入 `--psm` + `--branch`：CLI 直接调用增量报告创建接口。

必填：`--psm`, `--branch`
常用可选：`--os-type server`（默认，仅支持 `server/server-cpp/server-java/server-nodejs/python`）, `--author-id`, `--if-send-robot`

```bash
bytedcli codecov report create-incr --psm example.service.api --branch feat/demo
bytedcli codecov report create-incr --psm example.service.api --branch feat/demo --os-type server-java --if-send-robot
```

## report update

互斥：`--rid` 或 `--psm` + `--branch`。默认轮询等待 30s；`--no-wait` 立即返回；`--wait-timeout-sec` 调节。

```bash
bytedcli codecov report update --rid 10000001
bytedcli codecov report update --psm example.service.api --branch master --wait-timeout-sec 60
bytedcli codecov report update --rid 10000001 --no-wait
```

## report get

同样支持 `--rid` 或 `--psm` + `--branch`；后者会打印 `Resolved rid: …` 再调用 get。

```bash
bytedcli codecov report get --rid 10000001
bytedcli codecov report get --psm example.service.api --branch master
```

## report list

按 PSM 列历史报告；默认过滤 `line_covered_ratio > 0 && method_covered_ratio > 0`。

```bash
bytedcli codecov report list --psm example.service.api --branch master --limit 5
bytedcli codecov report list --psm example.service.api --no-only-valid
```

## report link

纯 URL 拼接，无 HTTP；脚本可直接消费。

```bash
bytedcli codecov report link --rid 10000001
# -> https://bits.bytedance.net/quality/measure/coverage-next/full?language=1&rId=10000001&region=cn&viewId=1
```

## access-status

查询单个 PSM 是否接入覆盖率平台。命令对外暴露 4 种稳定状态字符串：

| CLI status       | 含义                                                                              |
| ---------------- | --------------------------------------------------------------------------------- |
| `accessed`       | 已接入采集（后端 access_status=1）                                                |
| `not_accessed`   | 已在平台登记但未接入（后端 access_status=2，access_message 区分子状态）           |
| `inactive`       | 服务不活跃（后端 access_status=3）                                                |
| `not_registered` | 未在覆盖率平台登记任何服务实例（**推断状态**——也可能是 ACL 过滤或后端短暂空响应） |

注意 `not_registered` 是**推断状态**：CLI 在后端返回空 `services` 时合成此状态，但同样的形态也可能是 (a) 调用方对该 PSM 无权限、(b) 后端短暂空响应，或 (c) PSM 拼写错误。出现 `not_registered` 时，建议先核对 PSM 拼写并确认权限，再走接入流程。

`not_registered` 与 `not_accessed` 的区别：前者后端没有任何 PSM 记录（推断），后者已登记但尚未接入采集（权威）。

```bash
bytedcli codecov access-status --psm example.service.api
bytedcli -j codecov access-status --psm example.service.api
```

JSON 输出（`-j`）：

```json
{
  "psm": "example.service.api",
  "registered": true,
  "services": [
    {
      "psm": "example.service.api",
      "status": "not_accessed",
      "access_status_code": 2,
      "os_type": "server",
      "language": 1,
      "access_message": "not register"
    }
  ]
}
```

`not_registered` 情况下 `registered: false`，`services: []`。

## create-report (deprecated)

保留兼容老脚本，内部转发到 `codecov report create`。返回的 `bytest_url` 字段现在承载 bits coverage-next 链接，不再是旧 bytest 页面。参数 `--base-commit` 放宽到 7~64 位。

## create-tag / delete-tag / set-interval

采集侧命令，走 `srvcov.byted.org`，未做改动。
