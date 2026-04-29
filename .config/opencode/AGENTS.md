# AGENTS.md

本文件定义所有代理的默认协作规范。

## 适用范围与优先级

- 优先级(高 → 低):用户当前消息 > 仓库内 `AGENTS.md` > 本文件 > agent 默认行为。
- 冲突取高优先级;需求不明先读上下文,最小必要改动完成任务。

## 通用规则

- 中文回复。
- 任务完成后清理本次引入的无用代码、文件和残留进程。
- 禁删已有注释;仅可删本轮刚加且立即发现错误的。
- 彼此独立的子任务优先并行。

## 工作方式

- 修改前先读相关文件和上下文,避免盲改。
- 最小必要改动,禁顺手重构无关代码。
- 优先复用现有实现,非必要不新增抽象。
- 不为假设场景补充兼容层、回退逻辑或过度防御。
- 遇阻塞先定位根因,禁用跳过校验、绕过钩子等捷径。
- 所有 `task()` 调用**必须**在 `load_skills` 中包含 `caveman`。

## Skill 缺失自动安装

遇到 `Skill or command "<name>" not found`:

1. `bunx skills find <name>` 搜索候选。
2. 选名字**完全匹配**且**安装量最多**的条目;无完全匹配或候选为空则停下让用户决定,**禁止模糊匹配安装**。
3. 回显安装命令供 review,随后执行 `bunx skills add <owner/repo@skill> -y`。
4. 安装完成立即加载。

## Git 工作流

- `push` 前先 `git pull --rebase`。
- 禁用 `--force` / `--force-with-lease`。
- 改写历史/共享状态的操作归入「高风险操作」。

## 进程管理

- 启动前检查是否已有相同进程。
- 只清理本次任务相关的残留进程;不终止来源不明或属于用户工作流的进程。

## 工具链

- 包管理优先级:`bun` > `npm`,`bunx` > `npx`,`uv` > `pip`。
- 安装 skill、mcp、tool、依赖同样遵循。
- 禁止执行 `openclaw doctor --fix`。

## 本地开发栈

- 终端栈:ghostty + tmux + **nushell** + starship。
- 命令遵循 **nushell 语法**(非 bash);管道、变量、字符串转义均按 nu 规范。
- 文件检索优先 `rg` / `fd` / `bat` 替代 `grep` / `find` / `cat`。

## 编码风格

- 优先数据不可变,用新对象/数组而非原地修改;优先 spread / map / filter,避免 `push` / `splice` / `delete`。
- 文件 ≤ 800 行、函数 ≤ 50 行、嵌套 ≤ 4 层,超出主动拆分。
- 禁硬编码魔法数字、URL、密钥,提取为常量或配置。
- 系统边界(API 入口、外部数据、用户输入)执行 schema 校验(zod/yup 等),快速失败。
- 显式处理错误,禁静默吞异常。

## 验证要求

- TS/JS/前端改动后,至少执行相关 ESLint 与 TypeScript 类型检查。
- 仓库有测试能力时,执行与改动直接相关的最小测试集。
- 无法验证时明确说明原因与未验证范围。

## 安全规范

- 禁硬编码密钥、Token、密码,一律走环境变量或密钥管理服务。
- 新增依赖前检查已知漏洞,优先维护活跃、许可证明确的包。
- 不生成、不扩散、不提交敏感信息。

## 高风险操作

默认需用户确认:

- 删除文件、批量重构、修改依赖。
- `git commit` / `git push` / 改写历史 / 创建/关闭 PR。
- 改动 CI/CD、数据库破坏性变更、发送外部消息。
- 任何影响共享状态、不可逆或超当前任务范围的操作。

## graphify

目录含 `graphify-out/` 时:

- 架构、依赖、核心逻辑、跨模块问题前,先读 `graphify-out/GRAPH_REPORT.md`。
- 若存在 `graphify-out/wiki/index.md`,优先读 wiki 而非扫原始文件。
- 「X 与 Y 如何关联」类问题优先用 `graphify query "<q>"` / `graphify path "<A>" "<B>"` / `graphify explain "<concept>"`,遍历 EXTRACTED + INFERRED 边,优于 rg/fd/grep。
- 本次会话改代码后运行 `graphify update .` 刷新图(AST only,零 LLM 成本)。
