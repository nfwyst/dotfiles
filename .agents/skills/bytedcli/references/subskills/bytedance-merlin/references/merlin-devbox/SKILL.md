---
name: merlin-devbox
description: 管理 merlin, seed 开发机：查询列表与详情、启动/停止、远程执行脚本、配置线上任务环境、检测当前是否为 Devbox 环境。当用户说"查看开发机/列出开发机/启动开发机/停止开发机/在开发机上执行/配置任务环境/mlx install/检测开发机环境/存储使用情况"时使用。
---

# 开发机管理

管理 Merlin 开发机的查询、生命周期、远程执行和环境配置。

## 前置条件

- 拥有目标开发机的访问权限
- `bytedcli merlin` 可用

### 环境检测

判断当前是否在 Merlin Devbox 中：

```bash
if [ -n "$ARNOLD_WORKSPACE_ID" ]; then
    echo "当前在开发机中，资源 ID: $ARNOLD_WORKSPACE_ID"
fi
```

完整检测（两个条件都满足才是 Devbox）：

```bash
env | grep -E "^(HOSTNAME=mlxlab|MERLIN_)" | head -20
```

| HOSTNAME 以 `mlxlab` 开头 | MERLIN_* 变量存在 | 结果 |
|--------------------------|-----------------|------|
| 是 | 是 | **Merlin Devbox** |
| 否 | 任意 | 非 Devbox |
| 是 | 否 | 非 Devbox |

### bytedcli merlin 安装检查

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

如果出现认证错误（401/403），运行 `bytedcli auth login`。

---

## 1. 查询开发机

### 列出所有开发机

```bash
bytedcli merlin devbox list
```

### 获取特定开发机详情

```bash
bytedcli merlin devbox get --resource-id 12345
```

等待开发机变为运行状态：

```bash
bytedcli merlin devbox get --resource-id 12345 --wait-until-running
```

输出包含：基本信息（ID、名称、状态、所有者）、访问信息（VSCode URL、SSH 命令、WebShell URL）、资源配置（CPU、内存、GPU）等。

开发机状态：`running`（运行中）、`stopped`（已停止）、`starting`（启动中）、`stopping`（停止中）。

---

## 2. 生命周期管理

### 启动开发机

```bash
bytedcli merlin devbox start --resource-id 12345
```

### 停止开发机

```bash
bytedcli merlin devbox stop --resource-id 12345
```

强制停止（包括所有 remote worker）：

```bash
bytedcli merlin devbox stop --resource-id 12345 --force-stop-worker
```

### 查询存储使用情况

```bash
bytedcli merlin devbox get-usage --resource-id 12345
```

输出包含系统盘、bytedrive、bytenas 的使用情况。

**注意**：停止开发机前确保没有重要任务在运行；如果有 remote worker 运行，需使用 `force_stop_worker: true`。

---

## 3. 远程执行脚本

在指定开发机中远程执行命令，60 秒超时限制。

```bash
bytedcli merlin devbox execute-script --resource-id 12345 --cmd nvidia-smi
```

```bash
bytedcli merlin devbox execute-script --resource-id 12345 --cmd 'pip install numpy && python -c "import numpy; print(numpy.__version__)"'
```

在开发机环境中可直接执行命令，无需通过 bytedcli merlin。

**注意**：确保开发机处于 `running` 状态；敏感操作（如删除文件）请谨慎执行。

---

## 4. 配置线上任务环境

在开发机中配置与线上任务或任务模板一致的运行环境，用于复现和调试。

### 从任务链接安装

URL 包含 `development/instance/jobs`，提取 `job_run_id`：

```bash
bytedcli merlin devbox execute-script --resource-id '<id>' --cmd 'mlx install --job_run <job_run_id>'
```

### 从任务模板安装

URL 包含 `development/template/jobs`，提取 `job_def_name`：

```bash
bytedcli merlin devbox execute-script --resource-id '<id>' --cmd 'mlx install --job_def <job_def_name>'
```

### 强制覆盖安装

当底层镜像不同时，需用户确认后追加 `--force`：

```bash
bytedcli merlin devbox execute-script --resource-id '<id>' --cmd 'mlx install --job_run <job_run_id> --force'
```

**注意**：强制覆盖可能导致现有环境配置丢失，操作前必须得到用户确认。

---

## 关联技能

- `merlin-devbox-troubleshoot`：排查连接、启动和性能问题
- `merlin-devbox-worker`：启动和管理 MLX GPU Worker
