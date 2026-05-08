---
name: bytedance-lynx
description: "Operate Lynx tooling via bytedcli. Use when tasks mention Lynx tools or workflows, including LynxExample, DownloadLynxExample, Lynx examples, LynxExample apk/ipa/dmg artifacts, Android or iOS LynxExample app launch, LynxExample page switching, or getting LynxExample tag, commitHash, and download URL metadata. Current commands cover LynxExample artifact metadata, downloads for android, ios-device, ios-simulator, android-renderkit, mac-renderkit, and win-renderkit, plus Android and iOS LynxExample start/open page workflows."
---

# bytedcli Lynx

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

- 需要通过 bytedcli 使用 Lynx 工具能力
- 当前需要获取 LynxExample 的 tag、platform、commitHash 和下载 URL
- 当前需要下载 LynxExample 的 Android、iOS 或 RenderKit 产物
- 当前需要启动 Android 或 iOS LynxExample app，或在运行中的 app 内打开/切换 Lynx 页面

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 当前能力不需要用户手动提供认证信息

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 只解析 metadata，不下载
bytedcli lynx example get

# JSON 模式 metadata
bytedcli --json lynx example get --tag latest --platform ios-simulator

# 下载默认 android 产物
bytedcli lynx example download

# 下载指定平台并写入目标目录
bytedcli lynx example download \
  --tag latest \
  --platform ios-simulator \
  --output-dir ./lynx-example-downloads

# 覆盖已存在文件
bytedcli lynx example download --platform android --force

# 使用 aria2c 分片并发下载
bytedcli lynx example download --platform android --downloader aria2c --download-concurrency 4

# 启动 Android LynxExample app
bytedcli lynx example android start

# 启动时打开指定 Lynx 页面
bytedcli lynx example android start --url https://example.test/page.js

# 在运行中的 Android LynxExample app 内切换 Lynx 页面
bytedcli lynx example android open --url https://example.test/other.js

# 启动 iOS Simulator 中的 LynxExample app
bytedcli lynx example ios start

# 启动 iOS LynxExample app 时打开指定 Lynx 页面
bytedcli lynx example ios start --url https://example.test/page.js

# 在运行中的 iOS LynxExample app 内切换 Lynx 页面
bytedcli lynx example ios open --url https://example.test/other.js
```

## 支持的 platform

- `android`
- `ios-device`
- `ios-simulator`
- `android-renderkit`
- `mac-renderkit`
- `win-renderkit`

## 输出字段

向用户展示结果时优先保留：

- `tag`
- `platform`
- `commitHash`
- `downloadUrl`
- `artifactCreatedAt`
- `outputPath`
- `bytes`
- `skipped`

## Notes

- `example get` 只解析产物元信息，不下载文件。
- `example download` 默认写入 `./lynx-example-downloads`。
- `example download` 默认使用 `--downloader auto`；本机存在 `aria2c` 时优先用 `aria2c -c -x 4 -s 4 -k 1M` 分片并发下载，否则回退到内置流式下载器。
- `example download --downloader builtin` 强制使用内置下载器；内置下载器会边读边写 `${outputPath}.part`，完成后再 rename 到最终文件。
- `--download-concurrency <count>` 只影响 `aria2c`，默认 `4`，可按需调小或调大，避免无必要地使用过高并发。
- `example download` 在文本模式会显示下载进度；`--json` 模式不输出进度，保持 stdout 为单行 JSON。
- 如果目标文件已存在，默认不会重复下载，会返回 `skipped=true`；传 `--force` 可覆盖。
- `example android start` 使用完整 Activity 路径 `com.lynx.uiapp/com.lynx.react.uiapp.SplashActivity`；传 `--url` 时通过 `lynx_initial_url` string extra 传给 SplashActivity。
- `example android open --url <url>` 使用 `lynx://open?url=` scheme 在运行中的 Android LynxExample app 内打开页面。
- Android app 控制命令需要本机 `adb` 可用，并且已有连接的设备或模拟器。
- `example ios start` 使用 `xcrun simctl launch booted com.lynx.LynxExample`；传 `--url` 时通过 `SIMCTL_CHILD_lynx_initial_url` 传递初始 Lynx 页面 URL。
- `example ios open --url <url>` 使用 `xcrun simctl openurl booted "lynx://open?url=..."` 在运行中的 iOS LynxExample app 内打开页面。
- iOS app 控制命令默认使用 `--simulator booted`，也可以传 Simulator UDID；需要本机 Xcode command line tools、已启动的 iOS Simulator，以及已安装的 LynxExample app。
- 需要机器可读输出加 `--json`，并放在 domain 前：`bytedcli --json lynx example get`。

## References

- `references/lynx.md`
- `references/invocation.md`
- `references/troubleshooting.md`
