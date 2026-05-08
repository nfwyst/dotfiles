---
name: merlin-devbox-troubleshoot
description: 排查 merlin, seed 开发机的各类故障，包括 SSH 连接失败、启动失败、Worker 登录失败、Notebook 无法连接远程 Worker、CPU/内存性能问题等。当用户说"开发机连不上/SSH 失败/Permission denied/开发机启动失败/一直启动中/Worker 登录不了/Notebook 连接 Worker 无响应/开发机卡顿/白屏/VSCode 连不上"时使用。
---

# 开发机故障排查

排查 Merlin 开发机的连接、启动和性能问题。根据用户描述的症状分流到对应的排查流程。

## 前置条件

- 拥有目标开发机的访问权限
- `bytedcli merlin` 可用（用于远程执行诊断命令）

### 环境检测

```bash
if [ -n "$ARNOLD_WORKSPACE_ID" ]; then
    echo "当前在开发机中，资源 ID: $ARNOLD_WORKSPACE_ID"
else
    echo "当前不在开发机中，需要使用 bytedcli merlin 远程执行"
fi
```

### bytedcli merlin 安装检查

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

如果出现认证错误（401/403），运行 `bytedcli auth login`。

## 场景分流

根据用户描述的症状，阅读对应的 reference 文件获取详细排查步骤：

| 症状 | 排查文档 |
|------|----------|
| 从本地 SSH 连接开发机失败、`Permission denied`、连接超时 | 阅读 `references/ssh-connection.md` |
| 开发机启动失败、长时间"启动中"、被自动关机 | 阅读 `references/startup-failure.md` |
| 在开发机中 SSH 到 Worker 失败、`Permission denied` | 阅读 `references/worker-login.md` |
| Notebook "Connect to remote worker" 无响应、无法选择 Worker | 阅读 `references/remote-worker-connection.md` |
| 开发机卡顿、白屏、VSCode 无法连接、SSH 频繁断开 | 阅读 `references/performance-issues.md` |

## 通用工具

在非开发机环境中执行诊断命令的通用方式：

```bash
bytedcli merlin devbox execute-script --resource-id '<resource_id>' --cmd '<诊断命令>'
```

获取开发机信息：

```bash
bytedcli merlin devbox get --resource-id '<resource_id>'
bytedcli merlin devbox list
```

## 兆底

如果对应的排查流程无法解决问题，建议用户联系 Merlin 平台支持团队。

## 关联技能

- `merlin-devbox`：查询、生命周期管理、远程执行
- `merlin-job-debug`：任务运行失败排查
