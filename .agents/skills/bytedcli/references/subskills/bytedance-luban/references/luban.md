# Luban

## Command map

- `bytedcli luban search`
  - `--npm <packageName>`：必填，传 `@scope/name` 形式的 npm 包名
  - `-v, --package-version <version>`：可选，按版本前缀过滤；不传时搜索该包名的所有结果
  - `--site us-ttp`：可选，切换到 TTP Luban 环境；不传时走默认 Bytedance Luban 环境

## Inputs

### NPM package name

`--npm` 需要传完整包名，例如 `@demo/uploader`。CLI 会自动把：

- `scope` 映射为请求体里的 `group`
- `name` 映射为请求体里的 `name`

### Version prefix

`--package-version` 为可选参数。传入时会映射为请求体里的 `version_prefix`，适合按 `2.1.5`、`2.1` 这类前缀过滤；不传时返回该包名的全部匹配结果。

### Environment

默认会请求 Bytedance Luban API，并从 `https://cloud.bytedance.net` 获取 JWT。传入 `--site us-ttp` 时，会切换到 TTP Luban API，并从 `https://cloud-ttp-us.bytedance.net` 获取 JWT；请求头里的 `origin` / `referer` 也会同步切换到 TTP Luban Web 域名。

## Output

- 文本模式：紧凑表格，便于快速查看包名、版本、仓库和创建时间
- JSON 模式：原始 API 响应，便于脚本和 agent 继续处理
