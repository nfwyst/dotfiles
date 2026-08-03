# AGENTS.md

全局默认协作规范项目内 `AGENTS.md` 或用户当前指令优先

## 通用规则

- 中文回复
- 做最小必要改动;不盲改、不顺手重构无关代码
- 优先复用现有实现;非必要不新增抽象、兼容层或回退逻辑
- 遇阻塞先定位根因;禁止跳过校验、绕过钩子等捷径
- 任务完成后清理本次引入的无用代码、文件和残留进程
- 禁删已有注释;仅可删本轮刚加且立即发现错误的注释
- 独立子任务优先并行
- 每次回复必须使用 caveman ultra 模式精简输出
- 派发子任务/子代理时, 强制为子任务/子代理启用 caveman skill 精简输出模式
- 解析图片优先调用具备多模态视觉能力的代理或工具

## 工具链

- 包管理优先级:`bun` > `npm`,`bunx` > `npx`,`uv` > `pip`;不可用再降级
- 文件检索优先 `rg` / `fd` / `bat`
- 在 nushell 中使用 `cat` 时, 请在前面添加 `^`, 用 `^cat` 命令执行
- 执行 openspec 命令时, 对于需要确认的命令, 请始终添加 `-y` 参数
- Skill 缺失时用 `bunx skills find <name>` 查找; 仅安装名称完全匹配且最可信的条目,并先征得用户确认
- 启动进程前检查同类进程;只清理本次任务相关进程
- opencode 会话 `node` 可能是 bun shim(`/private/tmp/bun-node-*`),致 `pnpm`/`npm` 隐式 `exec node` 撞 `node:sqlite` 崩溃;执行前 `command -v node` 命中 `bun-node` 时,须 `PATH=/opt/homebrew/bin:$PATH <cmd>` 显式修 PATH

## 编码风格

- JS/TS:优先数据不可变,用新对象/数组而非原地修改,优先 spread / map / filter,避免 `push` / `splice` / `delete`
- 其它语言:遵循目标语言惯用风格
- 文件 ≤ 800 行、函数 ≤ 50 行、嵌套 ≤ 4 层,超出主动拆分.豁免:自动生成代码、测试 fixture、数据表、schema 定义
- 禁硬编码魔法数字、URL、密钥,提取为常量或配置
- 系统边界(API 入口、外部数据、用户输入)执行 schema 校验并快速失败
- 显式处理错误;禁静默吞异常

## 验证

- TS/JS/前端改动后,仓库有配置时执行相关 ESLint 与 TypeScript 检查
- 仓库有测试能力时,执行与改动直接相关的最小测试集
- 无法验证时明确说明原因与未验证范围

## 安全与高风险

- 禁硬编码密钥、Token、密码,一律走环境变量或密钥管理服务
- 新增依赖前检查已知漏洞,优先维护活跃、许可证明确的包
- 不生成、不扩散、不提交敏感信息
- 高风险操作需用户确认:删除非本轮生成的文件、批量重构、修改依赖、创建备份文件、改动 CI/CD、数据库破坏性变更、发送外部消息
- Git 高风险操作需用户确认:`commit` / `push` / `checkout` / `restore` / `reset` / `--force` / `--force-with-lease` / 改写历史 / 创建或关闭 PR
- `push` 前先 `git pull --rebase`

## CodeGraph

在 CodeGraph 索引的仓库中（仓库根目录下存在 `.codegraph/` 目录），当您需要理解或定位代码时，请先使用 CodeGraph，然后再使用 grep/find 或读取文件：

- **MCP 工具**（如果可用）：`codegraph_explore` 一次调用即可解答大多数代码问题——返回相关符号的源代码以及它们之间的调用路径。`codegraph_node` 返回单个符号的源代码及其调用者，或者读取包含行号的整个文件。如果工具已列出但未启用，请通过工具搜索按名称加载它们。
- **Shell**（始终有效）：`codegraph explore "<符号名称或问题>"` 和 `codegraph node <符号或文件>` 的输出相同。

如果没有 `.codegraph/` 目录，则完全跳过 CodeGraph——是否使用索引由用户决定。
