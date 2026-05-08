---
name: bytedance-aitest
description: "执行 QA 辅助任务和测试能力。当涉及运行测试 skill、调用 bytedcli aitest 时，务必触发本技能。请特别注意：使用 `bytedcli aitest --help` 可以获取所有的指令介绍与能力说明。"
---

# bytedcli Aitest

## 如何调用 bytedcli

先选择一种调用方式。下面所有示例默认直接写 `bytedcli`。

```bash
# 方式 1：直接用 npx 运行占位包名示例
npx -y @example/bytedcli@latest <command> [options]

# 方式 2：先全局安装占位包名示例，再直接调用 bytedcli
npm install -g @example/bytedcli@latest
bytedcli <command> [options]
```

- 使用 `npx` 时，把后文示例里的 `bytedcli` 替换成 `npx -y @example/bytedcli@latest`
- 如果你的环境已经直接提供 `bytedcli`，后文示例可以直接执行 `bytedcli ...`

## When to use

- 当需要运行测试任务或 QA 辅助任务时
- 当明确指定要调用 `bytedcli aitest` 时
- 需要向特定分类提供输入（文本、链接、图片）来获取输出结果时
- 当需要**获取所有的指令介绍与能力说明**时（使用 `bytedcli aitest --help`）

## Capabilities

支持通过 CLI 触发各类测试与 QA 辅助任务。常用命令包括：

- **`--help`**: 获取全部分类与能力说明。
- **`skill list`**: 获取当前可用的 skill 清单。
- **`skill get`**: 获取某个 `skill` 的详细文档或内容包。
- **`skill run`**: 执行指定的 `skill`。

## 执行工作流 (SOP)

为确保调用最新且确实存在的业务能力，执行具体任务前必须严格遵循以下两步工作流（Two-Step Workflow）。

### 步骤 1: 动态获取能力清单 (list)

在处理实际任务前，必须执行以下命令，获取当前系统所有可用的 skill 与其支持的能力名称：

```bash
# 获取所有分类与能力的说明
bytedcli aitest --help

# 仅获取 skill 分类下的说明
bytedcli aitest skill list
```

**要求：**
- 仔细阅读命令返回的所有能力介绍和参数说明。
- 严禁捏造任何不存在的 skill 名称。后续执行调用的能力必须在返回清单中明确列出。

### 步骤 2: 匹配并执行具体能力 (run / get)

根据具体任务目标，在清单中找到最匹配的名称，构造并执行目标命令。

#### 1. 运行技能 (skill run)

```bash
# 运行一个测试任务或测试能力（例如：requirement-analysis）
bytedcli aitest skill run -s <skill名称> [附加参数...]
```

**`run` 必选参数：**
- `-s, --skill <name>`: 指定运行的具体任务或能力名称，仅支持在 `skill list` 中列出的名称。

**`run` 常用附加参数：**
- `-i, --input <value>`: 多值参数（可多次使用）。支持传入文本、URL 链接、或者使用 `@` 读取本地文件/图片。
- `--format <format>`: 指定输出格式（如 `md`, `zip` 等）。
- `--output <path>`: 指定输出文件的保存路径。
- 文本类结果默认输出到 stdout；`md` 与二进制结果默认写入本地文件，未显式传 `--output` 时保存到 `./{name}.{ext}`。

#### 2. 获取技能详情 (skill get)

获取某个具体的 Skill 文件包或 Markdown 文档。

```bash
bytedcli aitest skill get -s <skill名称> [附加参数...]
```

**`get` 必选参数：**
- `-s, --skill <name>`: 指定需要获取详细信息的具体技能名称。

**`get` 常用附加参数：**
- `--format <format>`: 请求的输出格式：`md`（仅返回文档） 或 `zip`（返回完整包）。
- `--output <path>`: 指定输出文件的保存路径。
- 文本类结果默认输出到 stdout；`md` 与二进制结果默认写入本地文件，未显式传 `--output` 时保存到 `./{name}.{ext}`。

## 示例参考

```bash
# 1. 查看可用的测试能力列表
bytedcli aitest --help
bytedcli aitest skill list

# 2. 获取某个 skill 的详细信息文档
bytedcli aitest skill get -s sample-skill --format md --output ./SKILL.md

# 3. 运行 requirement-analysis，传入多个来源资料
bytedcli aitest skill run -s requirement-analysis -i "https://docs.example.com/prd" -i "@./spec.md"

# 4. 运行 data-entity-extra
bytedcli aitest skill run -s data-entity-extra -i "测试文本"
```
