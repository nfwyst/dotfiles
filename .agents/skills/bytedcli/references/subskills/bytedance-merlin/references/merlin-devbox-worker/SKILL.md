---
name: merlin-devbox-worker
description: 在 merlin, seed Devbox 中启动和管理 GPU/CPU Worker 节点，包括检查 quota、launch worker、管理 Terminal-to-WorkerID 映射。当用户说"启动 GPU worker/拉起 worker/检查 GPU quota/launch worker/worker 状态/worker 映射/清理 stale worker/需要 GPU 资源/运行任务需要 GPU"时使用。
---

# 开发机 Worker 管理

## 强制要求：禁用颜色与 ANSI 转义

**本 skill 中所有终端命令必须在前面加上 `NO_COLOR=1 TERM=dumb`**，以关闭颜色和 ANSI 转义，避免输出被污染、解析失败。适用于所有 `mlx worker` 子命令及本流程中的其他 shell 命令，无例外。

### 在 Trae 沙箱中运行（命令白名单）

形如 `NO_COLOR=1 TERM=dumb mlx worker list` 的命令可能**无法命中 Trae 的命令白名单**，因为白名单通常按命令/程序名（如 `mlx`）匹配，而不是整行（含环境变量）。

**方案 A – 扩展 Trae 白名单（推荐）：** 在白名单中允许带前缀的形式，例如允许模式 `NO_COLOR=1 TERM=dumb mlx worker *`，或将白名单配置为忽略前导 `VAR=value`，只匹配后面的 `mlx worker *`。

**方案 B – 同 shell 先 export 再执行：** 若沙箱在同一会话中复用同一 shell，可先执行一次：
```bash
export NO_COLOR=1 TERM=dumb
```
之后仅执行裸命令以命中白名单，如 `mlx worker list`、`mlx worker quota > /tmp/mlx_quota_output.txt 2>&1`、`mlx worker launch ...`。同一会话内 export 后**不要再**重复加前缀。

**方案 C – 若白名单允许 `env`：** 可执行：
```bash
env NO_COLOR=1 TERM=dumb mlx worker list
```
并在白名单中放行 `env` 或该完整模式。

---

## Worker 是什么

Merlin 开发机分为两部分：

- **Master 节点**：常驻的代码开发环境，具备少量 CPU 和内存资源
- **Worker 节点**：随用随启的计算节点，用于需要 GPU 或较多 CPU/内存的场景

Worker 分为普通 Worker 和 Ray Worker（与 Ray 任务绑定）。通过 `mlx worker` 命令管理。

### 查杀规则

为提升 GPU 利用率，平台对 Worker 配置了查杀规则：
- Worker 最多运行 **96 小时**，超时自动回收
- 过去 14 小时平均利用率需达标：

| 资源池 | Worker 类型 | 利用率要求 |
|--------|------------|----------|
| Workspace 公共资源 | CPU Worker | CPU ≥ 10% |
| Workspace 公共资源 | GPU Worker | GPU ≥ 10% |
| Arnold 用户组资源 | CPU Worker | CPU ≥ 25% |
| Arnold 用户组资源 | GPU Worker | GPU ≥ 25% |

---

## 场景识别

- **场景 A — 运行代码/任务需要 GPU**：用户要执行代码，Worker 只是手段。完整流程：检查已有 Worker → 检查 quota → 按需 launch。
- **场景 B — 明确启动 Worker**：用户直接要求启动/创建 Worker 或指定 GPU 资源（如"拉起一个 1 卡 H20 的 worker"）。**不要运行 `mlx worker list`**，直接：检查 quota → launch。

不确定时优先选场景 B。

---

## 检查已有 Worker（仅场景 A）

```bash
NO_COLOR=1 TERM=dumb mlx worker list
```

如果有可用 Worker，复用而非新建：

```bash
NO_COLOR=1 TERM=dumb mlx worker login <id>
```

---

## 检查 GPU Quota

两步操作避免终端截断：

```bash
NO_COLOR=1 TERM=dumb mlx worker quota > /tmp/mlx_quota_output.txt 2>&1
```

然后使用 **Read 工具**（不是 `cat`）读取 `/tmp/mlx_quota_output.txt`。

### 资源优先级

1. **Public Arnold 资源**（最高优先级，无需额外参数 或 `--resourcetype public-arnold`）
2. **Public Workspace 资源**（`--resourcetype workspace`）

按顺序检查每个区域，选择第一个有所需 GPU 类型的区域。

---

## Launch Worker

```bash
NO_COLOR=1 TERM=dumb mlx worker launch [options] -- <command>
```

### 常用选项

| 选项 | 简写 | 说明 | 默认 |
|------|------|------|------|
| `--gpu` | `-g` | GPU 数量 | 1 |
| `--type` | `-t` | GPU 类型（如 Tesla-V100-SXM2-32GB） | - |
| `--cpu` | `-c` | CPU 核数 | auto |
| `--memory` | `-m` | 内存 GiB | auto |
| `--resourcetype` | - | 资源类型：省略=`public-arnold`，`workspace`，`arnold` | - |
| `--usergroup` | - | Arnold 资源的用户组 | - |
| `--queuename` | - | Arnold 资源的队列名 | - |
| `--cluster` | - | 目标集群 | - |
| `--alias` | - | 自定义 Worker 别名 | - |

### 示例

```bash
NO_COLOR=1 TERM=dumb mlx worker launch --gpu 1 -- bash

NO_COLOR=1 TERM=dumb mlx worker launch --resourcetype arnold --usergroup <group> --cluster <cluster> --queuename <queue> --gpu 1 --type Tesla-V100-SXM2-32GB -- bash
```

### 故障排查

如果遇到 `read-only file system` 错误：

```bash
NO_COLOR=1 TERM=dumb sudo chmod -R 777 <directory>
```

---

## Worker 其他命令

| 命令 | 说明 |
|------|------|
| `NO_COLOR=1 TERM=dumb mlx worker list` | 列出活跃 Worker |
| `NO_COLOR=1 TERM=dumb mlx worker login <id>` | 登录 Worker |
| `NO_COLOR=1 TERM=dumb mlx worker kill <id>` | 终止 Worker |
| `NO_COLOR=1 TERM=dumb mlx worker quota` | 检查可用 quota |

---

## Terminal-Worker 映射管理

Worker launch 后需记录 terminal_id → worker_id 映射，便于后续复用和清理。

映射存储在 `~/.merlin/devbox/worker_state.json`，支持保存、查询、验证终端可用性、清理过期映射。

详细的操作命令和 Python 脚本见 `references/worker-state.md`。

**核心规则**：永远不要假设已记录的终端仍然可用，使用前必须与系统 `<available_terminal>` 交叉验证。

---

## 关联技能

- `merlin-devbox`：开发机管理（查询、启停、远程执行）
- `merlin-devbox-troubleshoot`：开发机故障排查
