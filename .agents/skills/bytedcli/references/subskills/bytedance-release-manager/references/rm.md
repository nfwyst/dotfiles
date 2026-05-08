# Release Manager

ByteCloud Release Manager 是面向稳定性敏感服务的发布编排平台，支持灰度策略（abonly / reversalab / noab 等）、多阶段工作流、自动 / 手动 confirm、灰度比例调整、回滚等。

UI: `https://cloud-ttp-us.bytedance.net/release_manager/pipeline/<pipeline>` 和
    `https://cloud-ttp-us.bytedance.net/release_manager/pipeline/<pipeline>/release/<release_id>`

bytedcli 通过 `/api/v1/releasemanager/api/v4/...` API 提供查询能力（不做写操作）。

## 命令

```bash
bytedcli release-manager release get  --id <release_id>            # 单次 release 详情
bytedcli release-manager release list --pipeline <name> [options]  # release 列表（默认历史）
bytedcli release-manager pipeline list [options]                   # pipeline 列表（默认全部）
```

`release-manager` / `release-manager release` / `release-manager pipeline` 不带子命令时打印帮助。

## `release-manager release get`

```bash
bytedcli --site us-ttp release-manager release get --id user_data_accessor_ttp.efb23b9e-c7d4-404d-914e-0d98b4f44df2
```

| 参数 | 默认 | 说明 |
|------|------|------|
| `--id <release_id>` | — | 必填，格式 `<pipeline>.<uuid>` |

文本模式输出：

- 顶部一组 `Release` 元信息（pipeline / state / strategy / creator / startTime / endTime / note / rollback）
- `Repo Versions` 表：repo / branch / `base → target`
- `Workflow` 表：每个阶段的 status + start/end
- `Clusters` 表：每个目标集群的 PSM / cluster / region / status

JSON 模式：完整 detail 对象，外加 `raw` 字段保留后端原始 payload。

## `release-manager release list`

```bash
bytedcli --site us-ttp release-manager release list --pipeline tiktok_sort_release
bytedcli --site us-ttp release-manager release list --pipeline tiktok_sort_release --running
bytedcli --site us-ttp release-manager release list --pipeline tiktok_sort_release --page 3 --page-size 20
```

| 参数 | 默认 | 说明 |
|------|------|------|
| `--pipeline <name>` | — | 必填 |
| `--running` | (omit) | 裸 flag：传则只看进行中的 release（服务端 `running=true`）；不传则默认历史 |
| `--page <n>` | `1` | 1 起步 |
| `--page-size <n>` | `10` | 每页条数 |

文本模式：表格列 `RELEASE_ID / STATE / STRATEGY / CREATOR / STAGE / STARTED`。

JSON 模式：

```json
{
  "pipeline": "tiktok_sort_release",
  "running": false,
  "page": 1,
  "page_size": 10,
  "returned": 10,
  "releases": [
    {
      "pipeline": "tiktok_sort_release",
      "releaseId": "tiktok_sort_release.<uuid>",
      "creator": "...",
      "strategy": "ab",
      "state": "Succeed",
      "startTime": "2026-04-28T...",
      "endTime": "2026-04-28T...",
      "currentStage": "...",
      "baseVersions": ["2.0.0.6430"],
      "targetVersions": ["2.0.0.6458"]
    }
  ]
}
```

## `release-manager pipeline list`

```bash
bytedcli --site us-ttp release-manager pipeline list                                     # 全部
bytedcli --site us-ttp release-manager pipeline list --following                    # 仅订阅
bytedcli --site us-ttp release-manager pipeline list --owner alice
bytedcli --site us-ttp release-manager pipeline list --search tiktok_sort --page-size 20
```

| 参数 | 默认 | 说明 |
|------|------|------|
| `--following` | (omit) | 裸 flag：传则只看自己订阅的（服务端 `only_subscription=true`）；不传则默认全部 |
| `--owner <username>` | — | 按 owner 用户名过滤（服务端） |
| `--search <keyword>` | — | 按 pipeline 名称搜索（服务端） |
| `--status <status>` | — | 状态过滤（服务端） |
| `--page <n>` | `1` | |
| `--page-size <n>` | `10` | |

文本模式：表格列 `NAME / FOLLOWING / RUNNING / OWNERS / LAST_UPDATE`（OWNERS 只显示前 3 个，超出用 `+N` 表示）。

JSON 模式：

```json
{
  "following": false,
  "owner": "",
  "search": "",
  "status": "",
  "page": 1,
  "page_size": 10,
  "returned": 5,
  "pipelines": [
    {
      "name": "tiktok_sort_release",
      "desc": "...",
      "owners": ["..."],
      "subscribed": true,
      "runningReleaseCount": 6,
      "lastUpdate": "2026-..."
    }
  ]
}
```

## 站点支持

当前**只接通了 `--site us-ttp`**：

- API host: `https://cloud.tiktok-us.net`
- JWT host: `https://cloud-ttp-us.bytedance.net`
- Web origin: `https://cloud-ttp-us.bytedance.net`

要扩展到 CN / i18n-tt / eu-ttp，只需要：

1. 抓一份对应站点 RM 网页发出的 `GET /api/v1/releasemanager/api/v4/...` 请求
2. 在 `src/api/release_manager/site.ts` 的 `SITES` 里加上 `apiBaseUrl` / `jwtHost` / `webOrigin`，并在 `ReleaseManagerSite` 类型加上对应 site 字面量
3. 补一条 `test/api/release_manager/release_manager.test.ts` 用例覆盖新 site 的 URL 拼接

## 认证

走标准 ByteCloud JWT。首次在 TTP-US 站点使用前确认登录态：

```bash
BYTEDCLI_CLOUD_SITE=us-ttp bytedcli auth status
# 必要时
BYTEDCLI_CLOUD_SITE=us-ttp bytedcli auth login
```

否则会报 `获取字节云 JWT 失败: 401`。

## 常见错误

- `RM_SITE_UNSUPPORTED` → 当前只支持 `--site us-ttp`，其他 site 没接通；按 「站点支持」 一节扩展
- `RM_API_ERROR ... permission denied` / 403 → 该 pipeline 你没权限，去 RM Web 申请
- `RM_PARSE_ERROR` → 后端返回的 payload 不是 `{code, message, data}` 标准信封；附带 `details` 看原始响应
- `获取字节云 JWT 失败: 401` → 没登录 TTP-US 站点，先 `BYTEDCLI_CLOUD_SITE=us-ttp bytedcli auth login`
