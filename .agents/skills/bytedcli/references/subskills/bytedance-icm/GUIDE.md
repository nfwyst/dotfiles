---
name: bytedance-icm
description: "Operate ByteDance ICM (Image Cloud Management, 镜像云管理) via bytedcli: list namespaces/spaces, list/get images (repositories), list/get image versions (build history), view build logs, resolve pullable image names, inspect latest tags and vregions. Use when tasks mention ICM, 镜像, 镜像仓库, 镜像管理, 镜像版本, 构建历史, 构建日志, 镜像空间, 命名空间, image registry, container image, docker pull, build history, image version, 收藏镜像. Also use when the user references cloud.bytedance.net/icm or image-manager.byted.org."
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
- 列出镜像版本（构建历史，包含镜像地址），按状态筛选
- 获取镜像版本详情（含构建日志 URL、SCM 提交信息）
- 按 namespace、PSM 和版本解析各 region 的完整镜像名，并输出 `docker pull` 命令
- 按完整镜像名反查版本元信息
- 查询最新 tag 和 vregion 元信息
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
bytedcli icm namespace search --keyword demo-ns

# 只看收藏的空间
bytedcli icm namespace list --starred
```

### 镜像仓库

```bash
# 默认列出收藏的镜像
bytedcli icm image list --page-size 20

# 查看全部镜像
bytedcli icm image list --all --page-size 20

# 按空间名筛选
bytedcli icm image list --namespace TCE

# 空间名会先解析为 namespace_id，因此大小写不必完全一致
bytedcli icm image list --namespace demo-ns

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

# 组合筛选：收藏 + 类型 + 空间（默认收藏）
bytedcli icm image list --image-type base --namespace-id 2

# 获取镜像详情
bytedcli icm image get --id 214652

# 按仓库名获取镜像详情，会先解析 image ID
bytedcli icm image get --repository demo-ns/demo-image

# 获取某个镜像在指定 region 的最新完整镜像名和 docker pull 命令
bytedcli icm image latest-tag --namespace TCE --psm demo-service --regions China-North-LF,Aliyun_SG

```

### 镜像版本（构建历史）

```bash
# 列出镜像的构建历史
bytedcli icm version list --image-id 214652

# 按仓库名列出构建历史，会先解析 image ID
bytedcli icm version list --repository demo-ns/demo-image

# 按状态筛选 (ok/fail/building/dropped/timeout)
bytedcli icm version list --image-id 214652 --status ok

# 按版本号筛选
bytedcli icm version list --image-id 214652 --version "1.0.0.106"

# 获取版本详情、完整镜像名和 docker pull 命令
bytedcli icm version get --image-id 214652 --version-id 37976396

# 按完整镜像名查询，会自动补齐 image_id/version_id 并合并版本详情
bytedcli icm version get --image-name hub.example.org/tce/demo-service:abc1234

# 已知镜像 ID 和版本号时查询
bytedcli icm version get --image-id 214652 --version 1.0.0.1
```

### 触发镜像构建

```bash
# 使用 JSON 文件触发 RepoBasedBuild
bytedcli icm image build --type repo --namespace TCE --payload-file ./icm-build.json

# 使用常用参数触发 GitBasedBuild
bytedcli icm image build --type git --namespace TCE --username demo-user --name demo-image --git-url git@code.example.org:demo/repo.git --git-branch main --build-path ./Dockerfile --regions China-North-LF --reuse

# 使用常用参数触发 DockerfileBasedBuild
bytedcli icm image build --type dockerfile --namespace TCE --username demo-user --name demo-image --dockerfile-file ./Dockerfile --regions China-North-LF --image-type normal
```

### Vregion

```bash
# 列出 vregion
bytedcli icm vregion list

# 按 vregion 名称查询
bytedcli icm vregion list --name China-North

# 按 VDC 查询
bytedcli icm vregion list --vdc lf
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

### 2. 触发一次镜像构建

```bash
cat > icm-build.json <<'JSON'
{
  "username": "demo-user",
  "psm": "demo-service",
  "base_image": "demo.base:latest",
  "region": ["China-North-LF"],
  "reuse": true
}
JSON

bytedcli icm image build --type repo --namespace TCE --payload-file ./icm-build.json
```

### 3. 查看我收藏的镜像

```bash
# 收藏的镜像列表
bytedcli icm image list

# 收藏的空间列表
bytedcli icm namespace list --starred
```

### 4. 获取可 pull 的完整镜像名

```bash
# 已知 image ID 和 version ID 时，直接查版本详情和各 region 的完整镜像名
bytedcli icm version get --image-id <id> --version-id <vid>

# 输出中会包含 Pull Command，例如 docker pull hub.example.org/tce/demo-service:abc1234
```

## Notes

- 需要结构化输出加 `--json`（全局选项，放在子命令之前，如 `bytedcli --json icm image list`）
- `image list` 默认只看收藏镜像；需要查看全部镜像时加 `--all`。
- 构建日志 URL 在版本详情的 `jenkins_id` / `Build Log` 字段中，指向 ByteBuild 或 Jenkins
- `image build --type` 支持 `dockerfile`、`git`、`repo`、`tce`，分别对应 DockerfileBasedBuild、GitBasedBuild、RepoBasedBuild、TCE build_multi_images；复杂构建参数建议用 `--payload-file`。
- `image latest-tag` 和 `version get` 会在文本输出中补充 `docker pull <image>`；`version get` 默认返回详细信息，JSON 输出中包含归一化参数、版本详情、版本元信息、region 镜像名和 `pull_commands`。
- 镜像类型说明：`base`（基础镜像）、`compile`（编译镜像）、`normal`（普通镜像）、`service`（服务类镜像）、`internalprivate`（私有化部署）、`oci_artifact`（自定义制品）、`third_party`（第三方镜像）

## References

- `references/invocation.md`
