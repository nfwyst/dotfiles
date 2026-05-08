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

## create-report (deprecated)

保留兼容老脚本，内部转发到 `codecov report create`。返回的 `bytest_url` 字段现在承载 bits coverage-next 链接，不再是旧 bytest 页面。参数 `--base-commit` 放宽到 7~64 位。

## create-tag / delete-tag / set-interval

采集侧命令，走 `srvcov.byted.org`，未做改动。
