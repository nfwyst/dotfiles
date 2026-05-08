---
name: merlin-profiling
description: 查询、查看、下载和上传 merlin-profiling 文件（Perfetto、Nsys、BGCP、Memotrace）。当用户提到查询 merlin-profiling 文件、下载 merlin-profiling、上传 merlin-profiling、查看 merlin-profiling 资产、获取 Perfetto/Nsys/BGCP/Memotrace 文件、根据 job ID 或 trial ID 查找 merlin-profiling 资产、merlin-profiling 文件的搜索与下载与上传时，都应使用本 skill。
---

# Profiling 资产管理

管理 Merlin 平台上的 merlin-profiling 文件，支持按 job ID、trial ID、owner、名称等条件搜索资产，查看详情，下载文件到本地（TOS 或 HDFS），以及上传本地 merlin-profiling 文件。

## 适用场景

- 查询 merlin-profiling 资产列表（MCP：`list_merlin-profiling_asset`）
- 获取单个 merlin-profiling 资产详情（MCP：`get_merlin-profiling_asset`）
- 获取 merlin-profiling 资产 TOS 下载链接（MCP：`get_merlin-profiling_asset_tos_link`）
- 下载 merlin-profiling 文件到本地
- 上传本地 merlin-profiling 文件

## 前置条件

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

如果出现认证错误（401/403），运行 `bytedcli auth login`。

## 操作导航

先根据用户意图找到对应的操作章节：

| 用户意图 | 常见表达 | 跳转 |
|---------|---------|------|
| 获取 / 下载 merlin-profiling 文件 | 查找某个 job 的 merlin-profiling、下载 trace 文件、获取 Perfetto 文件 | [1. 查询](#1-查询-merlin-profiling-资产列表) + [2. 查看详情](#2-查看资产详情) + [3. 下载](#3-下载-merlin-profiling-文件) |
| 上传 merlin-profiling 文件 | 上传 trace 文件、上传 Perfetto/Nsys 文件 | [4. 上传](#4-上传-merlin-profiling-文件) |
| 浏览 / 查询资产列表 | 列出我的 merlin-profiling 文件、看看有哪些 merlin-profiling | [1. 查询](#1-查询-merlin-profiling-资产列表) |

---

## 1. 查询 Profiling 资产列表

按 schema 字段传 option 过滤资产；object/array 字段传 JSON-valued option。完整参数列表用 `bytedcli merlin profiling list --schema` 查看。

```bash
bytedcli merlin profiling list --job-id 12345 --limit 20
bytedcli merlin profiling list --trial-id 67890
bytedcli merlin profiling list --owner user.name --asset-type perfetto
```

注意：`job_id` 和 `trial_id` 不能同时使用，请分开查询。

返回结果：`{ "asset": [...], "has_more": bool }`；每条资产的关键字段 `sid`、`name`、`asset_type`、`storage_type`、`owner`、`file_size`。

---

## 2. 查看资产详情

通过 SID 获取单个资产的完整信息。SID 既可作为位置参数传入，也可放在 `--json` 里。完整参数列表用 `bytedcli merlin profiling get --schema` 查看。

```bash
bytedcli merlin profiling get <SID>
bytedcli merlin profiling get --sid '<SID>'
```

---

## 3. 下载 Profiling 文件

### 第一步：检查环境

在下载之前，先检测当前环境是否有 HDFS 客户端：

```bash
which hdfs &>/dev/null && echo "HDFS_AVAILABLE" || echo "HDFS_NOT_AVAILABLE"
```

HDFS 客户端通常在 Merlin 开发机（生产网）上可用。这个检测结果决定后续使用哪种下载方式。

### 第二步：选择下载方式

**优先使用 HDFS 下载。** TOS 下载会经过后端服务生成预签名链接，单个文件没问题，但批量下载时容易导致服务 OOM。HDFS 直接走分布式文件系统，没有这个瓶颈。

| 环境 | 下载方式 | 命令 |
|------|---------|------|
| 有 `hdfs` 命令 | HDFS 直接下载（推荐） | `bytedcli merlin profiling download --sid '<SID>' --use-hdfs` |
| 无 `hdfs` 命令 | TOS 预签名链接下载 | `bytedcli merlin profiling download --sid '<SID>'` |

完整参数列表用 `bytedcli merlin profiling download --schema` 查看。

#### HDFS 下载（推荐）

当环境有 HDFS 客户端时，始终使用此方式：

```bash
bytedcli merlin profiling download --sid '<SID>' --use-hdfs
bytedcli merlin profiling download --sid '<SID>' --use-hdfs --output ./my-trace.perfetto
```

#### TOS 下载（回退方案）

仅当 HDFS 不可用时使用：

```bash
bytedcli merlin profiling download --sid '<SID>'
bytedcli merlin profiling download --sid '<SID>' --output ./my-trace.perfetto
```

默认保存到当前目录，文件名为资产名称。通过 JSON 里的 `output` 字段可指定保存路径。

注意：下载过程的进度信息输出到 stderr，不是 JSON 格式。

> TOS 预签名链接通过 Lineage Reporting 服务的 `copy-to-tos` 接口获取，对 HDFS 和 TOS 文件均有效（HDFS 文件会先被复制到 TOS 再返回链接，可能稍慢）。也可通过 MCP 工具直接获取链接（有效期 12 小时）：`get_merlin-profiling_asset_tos_link(sid="<SID>")`，返回 `signed_link`、`tos_key`、`size`。

### 批量下载的特殊处理

当用户需要下载多个 merlin-profiling 文件时（例如一个 job 下的所有 trace），处理方式取决于环境：

**有 HDFS 的环境**：直接批量下载，用 `use_hdfs: true` 逐个执行即可，HDFS 能承受负载。

**没有 HDFS 的环境**：必须先警告用户再操作。向用户说明以下内容，等用户明确确认后才能继续：

> ⚠️ 当前环境没有 HDFS 客户端，批量下载将通过 TOS 服务进行。大量并发请求可能导致后端服务内存溢出（OOM），影响其他用户。
>
> 建议：通过 Merlin 开发机（生产网内）执行批量下载，开发机上有 HDFS 客户端，下载更稳定且不会对服务造成压力。
>
> 如果仍要在当前环境下载，建议控制并发数并在文件之间加入间隔，减轻服务压力。是否继续？

如果用户确认继续，在每次下载之间加入短暂间隔（`sleep 2`），避免瞬间打满服务：

```bash
for sid in $SID_LIST; do
  bytedcli merlin profiling download --sid "$sid" --output "./merlin-profiling/${sid}.perfetto"
  sleep 2
done
```

---

## 4. 上传 Profiling 文件

通过 `--json` 传入参数。完整参数列表用 `bytedcli merlin profiling upload --schema` 查看。

```bash
bytedcli merlin profiling upload --file-path ./trace.perfetto --name my-trace --asset-type perfetto
bytedcli merlin profiling upload --file-path ./trace.perfetto --name my-trace --asset-type perfetto --job-id 12345
bytedcli merlin profiling upload --file-path ./trace.perfetto --name my-trace --asset-type perfetto --trial-id 67890
```

业务约束（不在 schema 里）：`job_id` 和 `trial_id` 互斥；都不提供时默认关联到 devbox 上下文；`owner` 不传则从 JWT token 自动检测。

默认输出为创建后的 asset JSON。

---

## 常见问题

| 现象 | 原因和处理 |
|------|-----------|
| `bytedcli: command not found` | 先安装 bytedcli（见前置条件） |
| 401 / 403 认证错误 | 运行 `bytedcli auth login` 重新登录 |
| HDFS 下载失败 | 确认当前环境有 HDFS 客户端（`which hdfs`）；如果没有，把 JSON 里 `use_hdfs` 去掉（或设为 `false`）改用 TOS 下载 |
| 批量下载导致服务异常 | TOS 下载经过后端服务，批量操作易导致 OOM。切换到 Merlin 开发机（生产网）使用 HDFS 下载 |
| TOS 链接获取慢（HDFS 文件） | `copy-to-tos` 需要先将文件从 HDFS 复制到 TOS，属正常现象 |
| `job_id` 和 `trial_id` 冲突 | 两者不能同时使用，请分开查询或上传 |

## 关联技能

- `bytedcli merlin`：当需要先发现可用命令、查询 schema 或做 CLI 兜底时使用
