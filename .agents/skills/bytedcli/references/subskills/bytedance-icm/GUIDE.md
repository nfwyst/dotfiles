---
name: bytedance-icm
description: "Operate ByteDance ICM (Image Cloud Management, 镜像云管理) via bytedcli: list namespaces/spaces, list/get images (repositories), list/get image versions (build history), view build logs. Use when tasks mention ICM, 镜像, 镜像仓库, 镜像管理, 镜像版本, 构建历史, 构建日志, 镜像空间, 命名空间, image registry, container image, build history, image version, 收藏镜像. Also use when the user references cloud.bytedance.net/icm or image-manager.byted.org."
---

# ICM — Image Cloud Management (bytedcli)

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

- 列出镜像空间（命名空间）
- 列出/搜索镜像仓库，按类型、空间、创建者、收藏等筛选
- 获取镜像仓库详情（含关联代码仓库、权限信息）
- 列出镜像版本（构建历史），按状态筛选
- 获取镜像版本详情（含构建日志 URL、SCM 提交信息）
- 查看收藏的空间或镜像

## 前置条件

- 按通用调用方式执行命令（含内网 registry）：`references/invocation.md`
- 需要鉴权的命令先登录：`bytedcli auth login`

## 常用命令

### 空间管理

```bash
# 列出所有空间
bytedcli icm namespace list --page-size 20

# 搜索空间
bytedcli icm namespace list --search "TCE"

# 只看收藏的空间
bytedcli icm namespace list --starred
```

### 镜像仓库

```bash
# 列出所有镜像
bytedcli icm image list --page-size 20

# 只看收藏的镜像
bytedcli icm image list --starred

# 按空间名筛选
bytedcli icm image list --namespace TCE

# 按空间 ID 筛选
bytedcli icm image list --namespace-id 2

# 按镜像类型筛选 (base/compile/normal/internalprivate/service/oci_artifact/third_party)
bytedcli icm image list --image-type service

# 按创建者筛选
bytedcli icm image list --creator demo-user

# 按镜像名筛选
bytedcli icm image list --name demo-image

# 按标签筛选
bytedcli icm image list --label go1.12.5

# 包含已删除的镜像
bytedcli icm image list --include-removed

# 组合筛选：收藏 + 类型 + 空间
bytedcli icm image list --starred --image-type base --namespace-id 2

# 获取镜像详情
bytedcli icm image get --id 214652
```

### 镜像版本（构建历史）

```bash
# 列出镜像的构建历史
bytedcli icm version list --image-id 214652

# 按状态筛选 (ok/fail/building/dropped/timeout)
bytedcli icm version list --image-id 214652 --status ok

# 按版本号筛选
bytedcli icm version list --image-id 214652 --version "1.0.0.106"

# 获取版本详情（含构建日志 URL）
bytedcli icm version get --image-id 214652 --version-id 37976396
```

## 典型工作流

### 1. 查找某个镜像的最新构建状态

```bash
# 先搜索镜像
bytedcli icm image list --name my-service --namespace TCE

# 用返回的 ID 查看构建历史
bytedcli icm version list --image-id <id> --page-size 5

# 查看具体版本的构建日志
bytedcli icm version get --image-id <id> --version-id <vid>
# 输出中的 "Build Log" 字段就是构建日志链接
```

### 2. 查看我收藏的镜像

```bash
# 收藏的镜像列表
bytedcli icm image list --starred

# 收藏的空间列表
bytedcli icm namespace list --starred
```

## Notes

- 需要结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json icm image list`）
- 构建日志 URL 在版本详情的 `jenkins_id` / `Build Log` 字段中，指向 ByteBuild 或 Jenkins
- 镜像类型说明：`base`（基础镜像）、`compile`（编译镜像）、`normal`（普通镜像）、`service`（服务类镜像）、`internalprivate`（私有化部署）、`oci_artifact`（自定义制品）、`third_party`（第三方镜像）

## References

- `references/invocation.md`
