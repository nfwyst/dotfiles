---
name: bytedance-kross
description: "Use bytedcli Kross commands to create multi-platform (Linux, macOS, Windows) container environments (workloads), list accessible workspaces, list workspace-visible container templates, list workloads, create and delete workloads, execute commands inside workload containers through webshell, and upload/download files to workload containers. Use when tasks mention Kross, workspace list, workload list, workload templates, create workload, delete workload, remote exec, or file transfer in a workload container."
---

# bytedcli Kross

Kross 用于创建多平台（Linux、macOS、Windows）容器环境（workload）。

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

- 查询某个 workspace 在当前 cluster 下可见的 container template
- 列出当前用户有权限访问的 workspace
- 列出某个 workspace 下的 workload
- 创建一组可随时创建和销毁的 job workload
- 删除已有 workload
- 通过 webshell 在 workload 容器里远程执行命令
- 在 workload 容器里上传或下载文件
- 已知 workspace 名称，只想做 workload 相关操作，但仍需要先看自己有哪些 workspace 可用

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 先完成目标站点登录：`bytedcli auth login`
- 如果是 BOE，先执行 `bytedcli --site boe auth login`
- 已知精确 workspace 名称，并且对该 workspace 有访问权限

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 先列出当前用户可访问的 workspace
bytedcli kross workspace list

# 先查当前 workspace 可用模板
bytedcli kross template list --workspace demo-workspace

# 再看当前 workspace 下已有 workload
bytedcli kross workload list --workspace demo-workspace

# quick create：创建 JOB 类型 workload
bytedcli kross workload create \
  --workspace demo-workspace \
  --name demo-job \
  --image demo/image:latest \
  --template-id linux-basic \
  --command 'sleep 300'

bytedcli kross workload create \
  --workspace demo-workspace \
  --name demo-job \
  --template-id linux-basic \
  --command 'sleep 300'

# advanced create：直接传完整 CreateWorkload body
bytedcli kross workload create \
  --workspace demo-workspace \
  --body-file ./demo-kross-job.json

# 删除 workload（按名称或 workload id 二选一）
bytedcli kross workload delete --workspace demo-workspace --name demo-job
bytedcli --json kross workload delete --workspace demo-workspace --workload-id 72

# 通过 webshell 执行命令
bytedcli kross workload exec --workspace demo-workspace --name demo-workload --command 'pwd'
bytedcli --json kross workload exec --workspace demo-workspace --workload-id 72 --container-name main-container --command-file ./diag.sh

# 上传/下载容器文件
bytedcli kross workload upload --workspace demo-workspace --name demo-workload --container-name main-container --local-path ./config.yaml --remote-path /tmp/config.yaml
bytedcli kross workload download --workspace demo-workspace --workload-id 72 --container-name main-container --remote-path /tmp/config.yaml --output ./config.yaml
```

## Recommended flow

### 1. 先看 workspace 和模板

先用 `kross workspace list` 看当前用户可访问的 workspace；创建前再用 `kross template list --workspace <name>` 获取该 workspace 在所属 cluster 下可见的 container template，并从返回结果里选择 `template id`。

### 2. 创建 job workload

优先使用 quick create：

```bash
bytedcli kross workload create \
  --workspace demo-workspace \
  --name demo-job \
  --image demo/image:latest \
  --template-id linux-basic \
  --command 'sleep 300'
```

quick create 默认会带上：

- CPU request/limit = `1000m`
- memory request/limit = `2048 MB`
- `timeoutSeconds = 300`
- `autoDeleteOnCompletion = true`

如需覆盖默认规格，可显式传：

- `--cpu-request-milli`
- `--cpu-limit-milli`
- `--memory-request-mb`
- `--memory-limit-mb`
- `--timeout-seconds`

如果模板本身提供默认镜像，quick create 可以省略 `--image`。
如果模板锁定了 `image` 字段，quick create 不接受 `--image`，需要直接使用模板镜像。

### 3. 在 workload 中执行命令

```bash
bytedcli kross workload exec \
  --workspace demo-workspace \
  --name demo-workload \
  --command 'hostname; pwd'
```

- 默认使用非 TTY webshell，返回更干净的 stdout
- 只有需要终端语义时再加 `--tty`
- 如果 workload 有多个容器，显式传 `--container-name`
- 如需指定 shell，可传 `--shell`

### 4. 上传或下载容器文件

```bash
bytedcli kross workload upload \
  --workspace demo-workspace \
  --name demo-workload \
  --container-name main-container \
  --local-path ./config.yaml \
  --remote-path /tmp/config.yaml

bytedcli kross workload download \
  --workspace demo-workspace \
  --workload-id 72 \
  --container-name main-container \
  --remote-path /tmp/config.yaml \
  --output ./config.yaml
```

- `upload` 必须传本地 `--local-path` 和容器内 `--remote-path`
- `download` 必须传容器内 `--remote-path` 和本地 `--output`
- 如果 workload 只有一个容器，可以省略 `--container-name`
- 如需指定 pod，可传 `--pod-name`

### 5. 清理 workload

```bash
bytedcli kross workload delete --workspace demo-workspace --name demo-job
```

如果是脚本或需要稳定消费输出，推荐把 `--json` 放在 `kross` 前面：

```bash
bytedcli --json kross workload exec --workspace demo-workspace --name demo-workload --command 'pwd'
```

## Notes

- `kross` 当前暴露 `workspace list`、`template list`、`workload list`、`workload create`、`workload delete`、`workload exec`、`workload upload`、`workload download`
- `workspace list` 会自动翻完分页，列出当前用户可访问的 workspace
- `workload list` 会自动翻完目标 workspace 下的 workload 分页
- CLI 会按 workspace 名称自动解析 ID，但要求名称精确；模糊名称会报错并返回候选项
- 其他 `--workspace <name>` 命令在按名称解析 workspace 时，也只会在当前用户可访问的 workspace 范围内匹配
- `template list` 会先取 workspace 的 `ClusterID`，再按模板详情里的 `VisibleClusterIDs` 过滤
- `create` 固定创建 `JOB` 类型 workload，模板必填
- quick create 在模板提供默认镜像时可以省略 `--image`
- 如果模板锁定 `image` 字段，quick create 不接受 `--image`
- 使用 `--body-file` 时，也需要在请求体里包含 `TemplateID`
- quick create 模式下，`--command` / `--command-file` 会映射到容器的 `Bootstrap` 字段
- `exec` 支持 `--name` 或 `--workload-id` 二选一
- Kross 鉴权复用 bytedcli 现有登录态，通过 `auth login` 后获取 ByteCloud JWT；不需要单独执行 Kross 登录
- `upload` 会先向 Kross 申请临时 capability URL，再通过 webshell 把文件拉到目标 workload
- `download` 会让 workload 先把远端文件推送到临时 capability URL，再由 CLI 下载到本地
- 这条临时文件链路同时适用于 Linux、macOS、Windows workload；Linux/macOS 目标容器需要提供 `curl`，Windows 目标容器需要提供 `curl.exe`
- `download` 使用 Kross 文件下载 API，并把响应内容写入 `--output`

## References

- `references/kross.md`
- `references/invocation.md`
- `references/troubleshooting.md`
