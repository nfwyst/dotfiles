---
name: bytedance-release-manager
description: "Query ByteCloud Release Manager pipelines and releases via bytedcli. Invoke when tasks mention release manager, RM 发布, release pipeline, 发布流水线, 单次 release 详情, 进行中的 release / 发布历史, or surface release state / strategy / rollback info / repo versions / cluster status."
---

# bytedcli Release Manager

## 如何调用 bytedcli

先选择一种调用方式。下面所有示例默认直接写 `bytedcli`。

```bash
# 方式 1：直接用 npx 运行最新版
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest <command> [options]

# 方式 2：先全局安装，再直接调用 bytedcli
NPM_CONFIG_REGISTRY=http://bnpm.byted.org npm install -g @bytedance-dev/bytedcli@latest
bytedcli <command> [options]
```

## When to use

- 查询 ByteCloud Release Manager 单条 release 的详情（state / strategy / 工作流阶段 / 集群状态 / 回滚信息 / repo 版本对照）
- 列出某个 pipeline 的发布历史（默认）或当前进行中的发布（`--running`）
- 列出可见 pipelines（默认全部，`--following` 限定为关注的），支持按 owner / 关键字 / 状态过滤
- 对应 UI：`https://cloud-ttp-us.bytedance.net/release_manager/pipeline/<pipeline>/release/<release_id>`

## Quick start

```bash
# 单次 release 详情（id 形如 <pipeline>.<uuid>）
bytedcli --site us-ttp release-manager release get \
  --id user_data_accessor_ttp.efb23b9e-c7d4-404d-914e-0d98b4f44df2

# 发布历史（默认 page=1, page_size=10）
bytedcli --site us-ttp release-manager release list --pipeline tiktok_sort_release

# 当前进行中的 release
bytedcli --site us-ttp release-manager release list --pipeline tiktok_sort_release --running

# 翻页 / 自定义页大小
bytedcli --site us-ttp release-manager release list --pipeline tiktok_sort_release --page 2 --page-size 20

# JSON 模式（agent / 脚本消费）
bytedcli --site us-ttp --json release-manager release get --id <release_id>
bytedcli --site us-ttp --json release-manager release list --pipeline <pipeline>

# 列出 pipelines（默认全部）
bytedcli --site us-ttp release-manager pipeline list

# 只看自己关注的 pipelines
bytedcli --site us-ttp release-manager pipeline list --following

# 按 owner / 关键字 / 状态过滤
bytedcli --site us-ttp release-manager pipeline list --owner alice
bytedcli --site us-ttp release-manager pipeline list --search tiktok_sort --page-size 20
```

## Notes

- **当前只支持 `--site us-ttp`**（API host `cloud.tiktok-us.net`，JWT 走 `cloud-ttp-us.bytedance.net`）。其他 site 调用会报 `RM_SITE_UNSUPPORTED`，附带提示去补 `src/api/release_manager/site.ts`。
- **release id 格式**：`<pipeline>.<uuid>`，例如 `tiktok_sort_release.0002ea2d-698c-4dea-b244-bda30244b27a`。`get` 必须传完整 id；用 `release list --pipeline <name>` 可以发现 id。
- **`--running` 是裸 flag**：传则只看进行中的 release；不传则默认是历史，与后端 `running=false` 行为一致。
- **`--following` 是裸 flag**：传则只看自己订阅的 pipeline；不传则默认是全部，与后端 `only_subscription=false` 行为一致。
- **分页**：`--page` 1 起步，`--page-size` 默认 10；服务端做分页，response 只包含当前页。
- **认证**：标准 ByteCloud JWT（`x-jwt-token` header），首次使用前确认已登录 TTP-US 站点：`BYTEDCLI_CLOUD_SITE=us-ttp bytedcli auth status`，否则会报 `获取字节云 JWT 失败: 401`。
- **JSON 输出结构**：
  - `release-manager release get` → `data` 为完整 detail（pipeline / state / strategy / workflow[] / clusters[] / abTestInfos[] / repoVersions[] / rollbackInfo / raw）
  - `release-manager release list` → `data.releases[]` 为分页列表，每条包含 releaseId / state / strategy / creator / currentStage / startTime / baseVersions[] / targetVersions[]
  - `release-manager pipeline list` → `data.pipelines[]` 每条包含 name / desc / owners[] / subscribed / runningReleaseCount / lastUpdate

## References

- [rm.md](./references/rm.md)
