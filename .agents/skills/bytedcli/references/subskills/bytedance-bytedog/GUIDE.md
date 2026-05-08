---
name: bytedance-bytedog
description: "Access ByteDog performance profiling and diagnostics via bytedcli and ByteDog API: CPU flamegraph (cpp/java/python) for TCE/K8s/machine/bytefaas/yarn, jemalloc memory flamegraph (enable/profile/download .fold), off-CPU flamegraph (IO/lock/sleep wait), Java profiling (gc/heap/thread/stack/lock/memory), IO profiling, GDB debugging, eBPF scripts, hardware profiling, alerts, benchmark, BizView, GlobalView, DiskView, and more. Use when tasks mention flamegraph, CPU profiling, memory profiling, jemalloc, off-CPU, lock contention, IO wait, perf, ByteDog, performance diagnostics, or profiling."
---

# ByteDog — Performance Profiling & Diagnostics

## 如何调用 bytedcli

先选择一种调用方式。下面所有示例默认直接写 `bytedcli`。

```bash
# 方式 1：直接用 npx 运行最新版
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]

# 方式 2：先全局安装，再直接调用 bytedcli
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli <command> [options]
```

- 使用 `npx` 时，把后文示例里的 `bytedcli` 替换成 `NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest`
- 已全局安装时，直接按后文示例执行 `bytedcli ...`

## When to use

- CPU 火焰图采集与分析（C++/Java/Python）
- **jemalloc 内存火焰图**（`bytedog memory-flamegraph`）：当怀疑内存泄漏、RSS 持续增长、或 RSS 与 QPS 解耦时，对 TCE pod 上的目标进程做增量 jemalloc profile，采集分配热点堆栈。流程：`processes` 列 pid → `enable` 激活 jemalloc profile → `profile` 采集 → `get` 轮询 → `download` 拉取 `.fold` 文件。进程需链接 ste 维护版本 jemalloc。
- **off-CPU 火焰图**（`bytedog offcpu-flamegraph`）：当 p99 飙升但 CPU 未饱和时，对 TCE pod 做 off-CPU 采样（锁等待、IO 等待、sleep 等），定位延迟来源。流程：`processes` 列 pid → `create --pids <csv> --duration 30` → `get` 轮询 → `download` 拉取 `.fold` 文件。US-TTP 默认 `tools_type=bytekd`。
- Java 性能诊断（GC/Heap/Thread/Stack/Lock/Memory）
- IO 性能分析与回放
- GDB 远程调试
- eBPF 脚本执行
- 硬件性能分析
- 告警管理（Argos/Vela）
- BizView/GlobalView/DiskView 分析
- 性能基准测试

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- ByteDog API 需要 ByteCloud JWT 认证：`references/auth.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## End-to-End Flamegraph Workflow

See `references/flamegraph-workflow.md` for the complete automated workflow to create, poll, and retrieve flamegraphs.

### Quick Example

```bash
# Step 1: Find which site the PSM lives on
for site in cn i18n-tt ttp-us-limited ttp-eu; do
  count=$(bytedcli --site $site tce instance list --psm <PSM> --env prod --page-size 1 --json 2>/dev/null \
    | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('data',{}).get('page_info',{}).get('total_count',0))" 2>/dev/null)
  [ "$count" -gt 0 ] && echo "$site: $count pods"
done

# Step 2: Pick a pod
bytedcli --site <site> tce instance list --psm <PSM> --env prod --page-size 5 --json

# Step 3: Create flamegraph (auth is handled automatically by bytedcli)
bytedcli --site <site> bytedog flamegraph create --pod <pod_name> --idc <IDC> --type cpp --duration 30 --frequency 99 --json

# Step 4: Check status (wait ~40s for 30s sampling + processing)
bytedcli --site <site> bytedog flamegraph get --id <task_id> --json

# Step 5: View result
# Console: https://<console_domain>/flamegraph/<task_id>
```

## API Reference

ByteDog PSM: `data.system.ste_bytedog_api` (496 endpoints, all POST)

Full API docs: https://cloud.bytedance.net/bam/rd/data.system.ste_bytedog_api/api_doc/show_doc

### Lookup API schema

```bash
# Get request/response schema for any endpoint
bytedcli bam method get --psm data.system.ste_bytedog_api --method <MethodName> --json
```

Method name format: PascalCase of HTTP method + path, e.g. `PostApiV2CpuFlamegraphTceCreate`.

### API Categories

See `references/api-reference.md` for the complete list of 496 endpoints.

| Category | Path Pattern | Description |
|----------|-------------|-------------|
| CPU Flamegraph | `/api/v2/cpu/flamegraph/{tce,k8s,machine,bytefaas,yarn}/{create,list,detail}` | Create/list/detail flamegraph tasks |
| Flamegraph Batch | `/api/v3/flamegraph/batch/{create,detail,draw,list,update}` | Batch flamegraph operations |
| Java Profiling | `/api/v2/java/{gc,heap,lock,memory,stack,thread}/{create,detail,list}` | Java diagnostics |
| IO Profiling | `/api/v3/io/{analyze,playback,record}/task/{create,detail,list}` | IO analysis & recording |
| GDB | `/api/v3/gdbv2/task/{create,detail,list}` | Remote GDB debugging |
| eBPF | `/api/v3/ebpf_script/task/{create,detail}` | eBPF script execution |
| Hardware | `/api/v2/hardware/ada/{tce,k8s,machine}/{create,detail}` | Hardware performance counters |
| Alerts | `/api/v2/alert/{argos,vela}/{create,delete,detail,list,update}` | Alert management |
| BizView | `/api/v3/bizview/...` | Business-level CPU analysis |
| GlobalView | `/api/v3/globalview/...` | Global CPU/lib analysis |
| DiskView | `/api/v3/diskview/...` | Disk IO metrics |
| Benchmark | `/api/v3/benchmark/{name/list,record/*}` | Performance benchmarks |
| ByteKD | `/api/v3/bytekd/...` | Long-range profiling & timeline |
| ByteLinter | `/api/v3/bytelinter/...` | Code performance linting |
| Bash/CLI Tasks | `/api/v3/bash/task/*`, `/api/v3/cli/task/*` | Remote task execution |
| Favorites | `/api/v3/favorite/{create,delete,detail,list,update}` | Saved tasks |
| History | `/api/v2/history/{list,update}` | Task history |
| Flamegraph PB | `/api/v3/flamegraph_protobuf/get` | Download protobuf flamegraph data |

## Domains

See `references/domains.md` for the complete domain mapping.

**IMPORTANT**: Production API domains (`ste-bytedog-api*.byted.org`) are NOT reachable from office network. Always use **console domains** (`bytedog*.bytedance.net`) with `X-Jwt-Token` header for API calls.

| Site | Console Domain (use this) | API Domain (prod network only) |
|------|--------------------------|-------------------------------|
| CN | `bytedog.bytedance.net` | `ste-bytedog-api.byted.org` |
| BOE | `bytedog-boe.bytedance.net` | `ste-bytedog-api-boe.byted.org` |
| I18N | `bytedog-i18n.bytedance.net` | `ste-bytedog-api-i18n.byted.org` |
| I18NBD | `bytedog.byteintl.net` | `ste-bytedog-api-i18nbd.byted.org` |
| EU-TTP | `bytedog.tiktok-eu.net` | `bytedog.tiktoke.org` |
| US-TTP | `bytedog-bd.tiktok-us.net` | `bytedog-usts.tiktokd.org` |
| Volc | `bytedog-volc.bytedance.net` | — |

## MCP Servers

- CN: `https://cloud.bytedance.net/ai/mcp_server/5ayursv4/tools?x-resource-account=public&x-bc-region-id=bytedance`
- ROW: `https://cloud-i18n.bytedance.net/ai/mcp_server/pq9drqch/tools?x-resource-account=i18n&x-bc-region-id=bytedance`
