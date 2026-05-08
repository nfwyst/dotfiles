# Lynx

## LynxExample metadata

```bash
# 默认解析 latest + android
bytedcli lynx example get

# 指定 tag 和平台
bytedcli lynx example get --tag latest --platform ios-simulator

# 适合 agent 消费的结构化输出
bytedcli --json lynx example get --tag latest --platform android
```

`example get` 返回单个可下载产物的元信息：

- `tag`
- `platform`
- `commitHash`
- `downloadUrl`
- `artifactCreatedAt`

## LynxExample download

```bash
# 默认下载 latest + android 到 ./lynx-example-downloads
bytedcli lynx example download

# 指定平台和输出目录
bytedcli lynx example download \
  --tag latest \
  --platform ios-simulator \
  --output-dir ./lynx-example-downloads

# 覆盖已存在文件
bytedcli lynx example download --platform android --force

# 使用 aria2c 分片并发下载
bytedcli lynx example download --platform android --downloader aria2c --download-concurrency 4

# 强制使用内置流式下载器
bytedcli lynx example download --platform android --downloader builtin

# JSON 输出，包含 outputPath / bytes / skipped
bytedcli --json lynx example download --platform android
```

下载行为：

- 默认 `--downloader auto`：本机存在 `aria2c` 时优先用 `aria2c -c -x 4 -s 4 -k 1M`，否则回退到内置下载器。
- `--download-concurrency <count>` 只影响 `aria2c` 分片连接数，默认 `4`。
- 内置下载器会边读边写 `${outputPath}.part`，完成后再 rename 到最终文件，不再把完整响应先聚合到内存。
- 文本模式会显示下载进度；`--json` 模式不输出进度，保持 stdout 为单行 JSON。

## Android LynxExample app control

```bash
# 启动 Android LynxExample app
bytedcli lynx example android start

# 启动时打开指定 Lynx 页面
bytedcli lynx example android start --url https://example.test/page.js

# 在运行中的 Android LynxExample app 内切换 Lynx 页面
bytedcli lynx example android open --url https://example.test/other.js

# JSON 输出，包含 adb args / packageName / component / intentData 等字段
bytedcli --json lynx example android open --url https://example.test/other.js
```

注意事项：

- `example android start` 使用完整 Activity 路径 `com.lynx.uiapp/com.lynx.react.uiapp.SplashActivity`。
- `example android start --url <url>` 通过 `lynx_initial_url` string extra 传递初始 Lynx 页面 URL。
- `example android open --url <url>` 使用 `lynx://open?url=` scheme 在运行中的 Android LynxExample app 内打开页面。
- Android app 控制命令需要本机 `adb` 可用，并且已有连接的设备或模拟器。

## iOS LynxExample app control

```bash
# 启动 iOS Simulator 中的 LynxExample app
bytedcli lynx example ios start

# 启动时打开指定 Lynx 页面
bytedcli lynx example ios start --url https://example.test/page.js

# 指定 Simulator UDID 或 booted selector
bytedcli lynx example ios start --simulator booted --url https://example.test/page.js

# 在运行中的 iOS LynxExample app 内切换 Lynx 页面
bytedcli lynx example ios open --url https://example.test/other.js

# JSON 输出，包含 simctl args / bundleId / simulator / intentData 等字段
bytedcli --json lynx example ios open --url https://example.test/other.js
```

注意事项：

- `example ios start` 使用 `xcrun simctl launch` 启动 bundle id `com.lynx.LynxExample`。
- `example ios start --url <url>` 通过 `SIMCTL_CHILD_lynx_initial_url` 传递初始 Lynx 页面 URL。
- `example ios open --url <url>` 使用 `lynx://open?url=` scheme 在运行中的 iOS LynxExample app 内打开页面。
- iOS app 控制命令默认使用 `--simulator booted`，也可以传 Simulator UDID；需要本机 Xcode command line tools、已启动的 iOS Simulator，以及已安装的 LynxExample app。

## Platforms

- `android`
- `ios-device`
- `ios-simulator`
- `android-renderkit`
- `mac-renderkit`
- `win-renderkit`

## Resolution rules

1. 根据 `--tag` 选择 `latest` 或历史 tag。
2. 根据 `--platform` 从 tag 记录里读取对应 `commitHash`。
3. 根据 `commitHash` 查找 package 记录。
4. 从 package 记录的同名 platform 对象读取下载 URL。
5. 如果 tag、platform、package 记录或下载 URL 缺失，命令会返回结构化错误，并在 details 中列出可用 tag 或 platform。

## Output file naming

下载文件名格式：

```text
lynx-example-<tag>-<platform>-<commitHash-prefix><ext>
```

`<ext>` 从下载 URL 路径推断，支持保留 `.tar.gz`、`.tar.bz2`、`.tar.xz` 这类复合后缀；没有后缀时使用 `.bin`。
