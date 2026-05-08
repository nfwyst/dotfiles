# ByteDog API Reference

PSM: `data.system.ste_bytedog_api` | 496 endpoints | All POST

Full API docs: https://cloud.bytedance.net/bam/rd/data.system.ste_bytedog_api/api_doc/show_doc

## CPU Flamegraph (v2)

Target types: `tce`, `k8s`, `machine`, `bytefaas`, `yarn`

```
POST /api/v2/cpu/flamegraph/{target}/create
POST /api/v2/cpu/flamegraph/{target}/list
POST /api/v2/cpu/flamegraph/{target}/detail
```

## CPU Flamegraph Batch (v3)

```
POST /api/v3/cpu/flamegraph/batch/create
POST /api/v3/cpu/flamegraph/batch/detail
POST /api/v3/cpu/flamegraph/batch/draw
POST /api/v3/cpu/flamegraph/batch/list
POST /api/v3/cpu/flamegraph/batch/update
POST /api/v3/cpu/flamegraph/batch/weight/update
```

## Flamegraph (v3)

```
POST /api/v3/flamegraph/batch/create
POST /api/v3/flamegraph/batch/detail
POST /api/v3/flamegraph/batch/draw
POST /api/v3/flamegraph/batch/list
POST /api/v3/flamegraph/batch/update
POST /api/v3/flamegraph/batch/weight/update
POST /api/v3/flamegraph/eventmatch/rule/create
POST /api/v3/flamegraph/eventmatch/rule/delete
POST /api/v3/flamegraph/eventmatch/rule/update
POST /api/v3/flamegraph_protobuf/get
```

## Java Profiling

Types: `gc`, `heap`, `lock`, `memory`, `stack`, `thread`

```
POST /api/v2/java/{type}/create
POST /api/v2/java/{type}/detail
POST /api/v2/java/{type}/list
POST /api/v2/java/{type}/create_by_url    # gc, heap, stack, thread only
```

## IO Profiling

Types: `analyze`, `playback`, `record`

```
POST /api/v3/io/{type}/task/create
POST /api/v3/io/{type}/task/detail
POST /api/v3/io/{type}/task/list
POST /api/v3/io/record/task/stop          # record only
POST /api/v2/io/biolatency/machine/create
POST /api/v2/io/biolatency/machine/detail
```

## Hardware Profiling

```
POST /api/v2/hardware/ada/{tce,k8s,machine}/create
POST /api/v2/hardware/ada/{tce,k8s,machine}/detail
POST /api/v3/hardware/bluewhale/create
POST /api/v3/hardware/bluewhale/detail
POST /api/v3/hardware/bluewhale/list
```

## Alert Management

Providers: `argos`, `vela`

```
POST /api/v2/alert/{provider}/create
POST /api/v2/alert/{provider}/delete
POST /api/v2/alert/{provider}/detail
POST /api/v2/alert/{provider}/list
POST /api/v2/alert/{provider}/update
POST /api/v2/alert/{provider}/job/list
```

## BizView

```
POST /api/v3/bizview/biz/detail
POST /api/v3/bizview/biz/func/top/sequence
POST /api/v3/bizview/biz/lib/caller/list
POST /api/v3/bizview/biz/lib/distribution
POST /api/v3/bizview/biz/list
POST /api/v3/bizview/cpu/binary/biz/list
POST /api/v3/bizview/cpu/func/binary/top
POST /api/v3/bizview/cpu/func/biz/top
POST /api/v3/bizview/flamegraph
POST /api/v3/bizview/flamegraph/biz_flag/list
POST /api/v3/bizview/flamegraph/dump
POST /api/v3/bizview/flamegraph/forge_resource_group/list
POST /api/v3/bizview/flamegraph/forge_role/list
POST /api/v3/bizview/flamegraph/java
POST /api/v3/bizview/flamegraph/java/dump
POST /api/v3/bizview/lib/biz/distribution
```

## GlobalView

```
POST /api/v3/globalview/cpu/biz/top
POST /api/v3/globalview/cpu/biztype/list
POST /api/v3/globalview/cpu/sequence
POST /api/v3/globalview/lib/biz/distribution
POST /api/v3/globalview/lib/detail
POST /api/v3/globalview/lib/list
```

## DiskView

```
POST /api/v3/diskview/label/distribution
POST /api/v3/diskview/label/distribution_sequence
POST /api/v3/diskview/metrics/charts
POST /api/v3/diskview/metrics/distribution
POST /api/v3/diskview/metrics/sequence
POST /api/v3/diskview/metrics/stats
```

## GDB Debugging

```
POST /api/v3/gdb/task/create
POST /api/v3/gdb/task/detail
POST /api/v3/gdb/task/list
POST /api/v3/gdb/ticket/create
POST /api/v3/gdb/ticket/detail
POST /api/v3/gdbv2/task/create
POST /api/v3/gdbv2/task/detail
POST /api/v3/gdbv2/task/list
POST /api/v3/gdbv2/ticket/create
POST /api/v3/gdbv2/ticket/detail
```

## Bash / CLI Tasks

```
POST /api/v3/bash/task/create
POST /api/v3/bash/task/detail
POST /api/v3/bash/task/list
POST /api/v3/bash/ticket/create
POST /api/v3/cli/task/create
POST /api/v3/cli/task/detail
POST /api/v3/cli/task/list
```

## eBPF Scripts

```
POST /api/v3/ebpf_script/task/create
POST /api/v3/ebpf_script/task/detail
```

## Benchmark

```
POST /api/v3/benchmark/name/list
POST /api/v3/benchmark/record/create
POST /api/v3/benchmark/record/detail
POST /api/v3/benchmark/record/list
```

## ByteKD

```
POST /api/v3/bytekd/cpu/longrangeprofiling/create
POST /api/v3/bytekd/cpu/longrangeprofiling/detail
POST /api/v3/bytekd/cpu/longrangeprofiling/list
POST /api/v3/bytekd/timeline/create
POST /api/v3/bytekd/timeline/detail
```

## ByteLinter

```
POST /api/v3/bytelinter/policy/list
POST /api/v3/bytelinter/policy/update
POST /api/v3/bytelinter/task/detail
POST /api/v3/bytelinter/task/list
```

## AutoFDO

```
POST /api/v3/autofdo/biz/perf/bolt/create
POST /api/v3/autofdo/kernel/perf/create
POST /api/v3/autofdo/kernel/perf/detail
```

## Other

```
POST /api/v3/branch_tracer/create
POST /api/v3/branch_tracer/get
POST /api/v3/goref/create
POST /api/v3/goref/detail
POST /api/v3/host_topo/create
POST /api/v3/host_topo/get
POST /api/v3/blktrace/task/create
POST /api/v3/blktrace/task/detail
POST /api/v3/blktrace/task/list
POST /api/v3/byteperf/count/task/create
POST /api/v3/dorado/department/list
POST /api/v3/dorado/project/list
POST /api/v3/favorite/create
POST /api/v3/favorite/delete
POST /api/v3/favorite/detail
POST /api/v3/favorite/list
POST /api/v3/favorite/update
POST /api/v2/history/list
POST /api/v2/history/update
POST /api/v3/helloworld
```

## LLM (AI Features)

```
POST /api/v4/llm/session/create
POST /api/v4/llm/session/delete
POST /api/v4/llm/session/abort
POST /api/v4/llm/session_group/create
POST /api/v4/llm/session_group/delete
POST /api/v4/llm/session_group/get
POST /api/v4/llm/session_group/list
POST /api/v4/llm/session_group/update
POST /api/v4/llm/message/create
POST /api/v4/llm/message/delete
POST /api/v4/llm/message/get
POST /api/v4/llm/message/list
POST /api/v4/llm/message/update
POST /api/v4/llm/message/path
POST /api/v4/llm/message/part/create
POST /api/v4/llm/message/part/get
POST /api/v4/llm/message/part/update
POST /api/v4/llm/block/create
POST /api/v4/llm/block/delete
POST /api/v4/llm/block/get
POST /api/v4/llm/block/list
POST /api/v4/llm/block/update
POST /api/v4/llm/confirm/create
POST /api/v4/llm/confirm/get
POST /api/v4/llm/confirm/list
POST /api/v4/llm/confirm/update
POST /api/v4/llm/inference/create
POST /api/v4/llm/forward
POST /api/v4/llm/responses/create
```
