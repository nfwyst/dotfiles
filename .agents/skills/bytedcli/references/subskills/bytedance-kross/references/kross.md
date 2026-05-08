# Kross 命令说明

Kross 用于创建多平台（Linux、macOS、Windows）容器环境（workload）。

## 命令面

当前 Kross CLI 暴露这几组能力：

- `kross workspace list`
- `kross template list`
- `kross workload list`
- `kross workload create`
- `kross workload delete`
- `kross workload exec`
- `kross workload upload`
- `kross workload download`

其中 `workspace` 只暴露 `list`；不暴露 workspace 的创建、修改、删除命令。CLI 默认假设调用方已经知道自己的 workspace 名称，并且有权限访问。

## Workspace 查询

```bash
bytedcli kross workspace list
```

- 返回当前用户有权限访问的 workspace
- CLI 会自动翻完分页，不需要手动指定 page 参数

## 模板查询

```bash
bytedcli kross template list --workspace demo-workspace
```

- 入参使用 workspace 名称，不需要手动传 workspace id
- CLI 会先解析 workspace，再按 workspace 绑定的 `ClusterID` 过滤模板
- 过滤逻辑参考 Kross 前端：读取模板详情里的 `VisibleClusterIDs`

## 查询 workload

```bash
bytedcli kross workload list --workspace demo-workspace
```

- 返回目标 workspace 下的 workload
- CLI 会自动翻完分页，不需要手动指定 page 参数
- 支持通过 `--name`、`--type`、`--status-cached` 做过滤

## 创建 job workload

### Quick create

```bash
bytedcli kross workload create \
  --workspace demo-workspace \
  --name demo-job \
  --image demo/image:latest \
  --template-id linux-basic \
  --command 'sleep 300'
```

Quick create 默认行为：

- workload 类型固定为 `JOB`
- `container-name` 默认是 `main-container`
- CPU request/limit 默认 `1000m`
- memory request/limit 默认 `2048 MB`
- `timeoutSeconds` 默认 `300`
- `autoDeleteOnCompletion` 默认 `true`

常用覆盖参数：

```bash
bytedcli kross workload create \
  --workspace demo-workspace \
  --name demo-job \
  --image demo/image:latest \
  --template-id linux-basic \
  --cpu-request-milli 2000 \
  --cpu-limit-milli 2000 \
  --memory-request-mb 4096 \
  --memory-limit-mb 4096 \
  --timeout-seconds 900 \
  --command 'sleep 300'
```

### Advanced create

如果需要完整控制 `CreateWorkload` 请求体，使用：

```bash
bytedcli kross workload create \
  --workspace demo-workspace \
  --body-file ./demo-kross-job.json
```

注意：

- `--body-file` 不能和 quick create 参数混用
- 请求体里仍然必须包含 `TemplateID`
- 如果模板提供默认镜像，quick create 可以省略 `--image`
- 如果模板锁定 `image` 字段，quick create 不接受 `--image`

## 删除 workload

```bash
bytedcli kross workload delete --workspace demo-workspace --name demo-job
bytedcli --json kross workload delete --workspace demo-workspace --workload-id 72
```

- `--name` 和 `--workload-id` 二选一
- 推荐脚本场景使用 `--json`

## 远程执行命令

```bash
bytedcli kross workload exec --workspace demo-workspace --name demo-workload --command 'pwd'
```

可选能力：

- `--container-name`：多容器 workload 时显式指定目标容器
- `--shell`：请求特定 shell
- `--pod-name`：指定 pod
- `--tty`：请求 TTY，会更接近交互终端语义
- `--output-file`：把命令输出落到本地文件

默认行为：

- 使用非 TTY webshell
- 自动剥离 ANSI 控制序列，得到更干净的 stdout
- 默认超时 `30000 ms`

## 上传/下载容器文件

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

- `upload` 和 `download` 都支持 `--name` 或 `--workload-id` 二选一
- `upload` 必须传 `--local-path` 和容器内目标 `--remote-path`
- `download` 必须传容器内来源 `--remote-path` 和本地 `--output`
- 如果 workload 有多个容器，显式传 `--container-name`
- 如需指定 pod，可传 `--pod-name`
- `upload` 会先向 Kross 申请临时 capability URL，再通过 webshell 把文件拉到目标 workload
- `download` 会让 workload 先把远端文件推送到临时 capability URL，再由 CLI 下载到本地
- 这条临时文件链路同时适用于 Linux、macOS、Windows workload；Linux/macOS 目标容器需要提供 `curl`，Windows 目标容器需要提供 `curl.exe`

## 推荐闭环

```bash
# 1. 查 workspace 和模板
bytedcli kross workspace list
bytedcli kross template list --workspace demo-workspace

# 2. 创建 workload
bytedcli kross workload create \
  --workspace demo-workspace \
  --name demo-job \
  --image demo/image:latest \
  --template-id linux-basic \
  --command 'sleep 300'

# 3. 远程执行命令
bytedcli kross workload exec \
  --workspace demo-workspace \
  --name demo-job \
  --command 'hostname; pwd'

# 4. 上传或下载容器文件
bytedcli kross workload upload \
  --workspace demo-workspace \
  --name demo-job \
  --container-name main-container \
  --local-path ./config.yaml \
  --remote-path /tmp/config.yaml

bytedcli kross workload download \
  --workspace demo-workspace \
  --name demo-job \
  --container-name main-container \
  --remote-path /tmp/config.yaml \
  --output ./config.yaml

# 5. 删除 workload
bytedcli kross workload delete --workspace demo-workspace --name demo-job
```
