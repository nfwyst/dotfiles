# Lidar 即时采样参数参考

Lidar 是字节服务性能平台，支持对 Golang / Python / Nodejs 服务发起即时 pprof 采样，无需提前部署采集 agent。

## 采样类型

### Golang

| 类型           | 分类 | `--duration`    | 说明                                            |
| -------------- | ---- | --------------- | ----------------------------------------------- |
| `heap`         | 瞬时 | 省略或 `-`      | 堆内存分配快照，用于定位内存泄漏                |
| `goroutine`    | 瞬时 | 省略或 `-`      | 当前所有 goroutine 栈，用于排查 goroutine 泄漏  |
| `allocs`       | 瞬时 | 省略或 `-`      | 自启动以来累计分配快照                          |
| `memstats`     | 瞬时 | 省略或 `-`      | Go 运行时内存统计                               |
| `block`        | 瞬时 | 省略或 `-`      | 阻塞事件采样                                    |
| `mutex`        | 瞬时 | 省略或 `-`      | mutex 竞争采样                                  |
| `waitduration` | 瞬时 | 省略或 `-`      | goroutine wait duration 采样                    |
| `dynconf`      | 瞬时 | 省略或 `-`      | Tango 子组：动态配置快照                        |
| `pod_cpu`      | 瞬时 | 省略或 `-`      | Pod CPU 使用快照                                |
| `profile`      | 时长 | 秒数（如 `30`） | CPU 热点火焰图，最常用的性能分析类型            |
| `trace`        | 时长 | 秒数            | Go 运行时 trace，包含 goroutine 调度、GC 事件等 |
| `latency`      | 时长 | 秒数            | Tango 子组：请求延迟分析                        |

完整可用值以 `bytedcli lidar sampling create --help` 输出为准。

### Python / Nodejs

与 Golang 使用相同命令，`--type` 可用值取决于服务端对该服务支持的采样类型。常用：

| 类型           | 语言   | 说明        |
| -------------- | ------ | ----------- |
| `profile`      | Python | CPU profile |
| `pyspy`        | Python | py-spy 采样 |
| `heap`         | Python | 堆内存快照  |
| `cpuprofile`   | Nodejs | CPU profile |
| `heapprofile`  | Nodejs | 堆采样      |
| `heapsnapshot` | Nodejs | 堆快照      |

## Lidar vs ByteDog 对照

| 场景                                           | 使用                |
| ---------------------------------------------- | ------------------- |
| Golang pprof（heap / profile / goroutine ...） | `bytedance-lidar`   |
| Python / Nodejs 即时采样                       | `bytedance-lidar`   |
| C++ CPU 火焰图                                 | `bytedance-bytedog` |
| Java 性能分析（GC / Heap / Thread / Stack）    | `bytedance-bytedog` |
| jemalloc 内存火焰图                            | `bytedance-bytedog` |
| off-CPU 火焰图（锁等待 / IO 等待）             | `bytedance-bytedog` |

## 域名说明

Lidar 使用两个独立域名，功能不同：

| 域名                        | 用途                                       |
| --------------------------- | ------------------------------------------ |
| `cloud.bytedance.net`       | 管理 API（创建采样、查询状态、列表历史等） |
| `lidar.bytedance.net`       | 数据服务（pprof 下载、火焰图渲染）         |

CLI 内部已做好域名路由，用户无需关心。

## 常见 Flow

### CPU 热点分析

```bash
# 1. 发起 profile 采样（30 秒），等待完成
bytedcli lidar sampling create --psm demo.psm.lidar --type profile --duration 30 --wait

# 2. 输出末尾会包含火焰图 URL 和下载 URL，直接在浏览器打开
# flamegraph_url: https://cloud.bytedance.net/lidar/service/instant-sampling?profilingId=<id>&psm=<psm>
# download_url:   https://lidar.bytedance.net/api/v1/pprof/ui/<id>/flamegraph?trigger_type=manual&download=true

# 3. 如果 --wait 超时，用 get 继续查
bytedcli lidar sampling get --id demo.psm.lidar_202604181600_abc
```

### Heap 内存泄漏排查

```bash
# 瞬时类型，不需要 --duration
bytedcli lidar sampling create --psm demo.psm.lidar --type heap --wait

# 对比不同时间点的 heap 快照
bytedcli lidar sampling list --psm demo.psm.lidar --type heap
```

### 下载原始 pprof 数据

```bash
# 下载到当前目录（自动命名为 <profiling_id>.pb.gz）
bytedcli lidar sampling download --id demo.psm.lidar_202604181600_abc

# 指定输出路径
bytedcli lidar sampling download --id demo.psm.lidar_202604181600_abc --output /tmp/heap.pb.gz

# 下载后可用 go tool pprof 本地分析
go tool pprof /tmp/heap.pb.gz
```

### 查询历史采样

```bash
# 最近 6h（默认）
bytedcli lidar sampling list --psm demo.psm.lidar

# 指定时间窗（支持 YYYY-MM-DD、YYYY-MM-DD HH:mm 或 unix 秒）
bytedcli lidar sampling list --psm demo.psm.lidar --begin "2026-04-18 10:00" --end "2026-04-18 18:00"

# 只看 profile 类型
bytedcli lidar sampling list --psm demo.psm.lidar --type profile

# 输出 JSON
bytedcli --json lidar sampling list --psm demo.psm.lidar
```

### 指定 Pod 采样

```bash
# 指定 pod 名称（不指定时服务端自动选择）
bytedcli lidar sampling create --psm demo.psm.lidar --type profile --duration 30 --pod-name demo-pod-xxx

# 指定 cluster
bytedcli lidar sampling create --psm demo.psm.lidar --type heap --cluster-id 123456
```

## 多 Site 说明

| 站点            | `--site` 值        | 说明                |
| --------------- | ------------------ | ------------------- |
| 国内（默认）    | `cn` 或省略        | ByteDance 国内生产  |
| ByteIntl 国际站 | `i18n` / `i18n-bd` | 通常复用 cn 登录态  |
| TikTok 国际站   | `i18n-tt`          | 需单独 `auth login` |

```bash
# ByteIntl 站点
bytedcli --site i18n-bd lidar sampling create --psm demo.psm.lidar --type heap

# TikTok 国际站（先检查认证）
bytedcli --site i18n-tt auth status
bytedcli --site i18n-tt lidar sampling create --psm demo.psm.lidar --type profile --duration 30
```

## 时区说明

`--begin` / `--end` 按**本机时区**解析，接受以下格式：

- `YYYY-MM-DD`（当天 00:00:00）
- `YYYY-MM-DD HH:mm`
- unix 秒字符串（如 `1775306700`）

CLI 内部会将解析后的 Date 转换为 unix 秒再下发给 API，与本机时区无关。

## 输出说明

- `sampling create` 成功后输出 profiling_id、pod_name、cluster 信息，以及 `download_url`
- `sampling get` 输出采样状态（`running` / `success` / `fail`）、火焰图 URL（成功时）和 `download_url`
- `sampling list` 以表格展示历史记录，含 profiling_id、类型、状态、发起时间
- `sampling download` 将原始 pprof 数据下载到本地，默认文件名为 `<profiling_id>.pb.gz`
- `--json` 模式返回完整结构化 JSON，含 `log_id` 和 `download_url` 字段
