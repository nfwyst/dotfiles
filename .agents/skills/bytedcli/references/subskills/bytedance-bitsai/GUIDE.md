---
name: bytedance-bitsai
description: "Use bytedcli BitsAI to answer ByteDance internal engineering knowledge and engineering asset questions. Trigger when the user asks exploratory or relationship-based questions about internal platforms, Bits release/dev-task/project/MR data, TCE/TCC/FaaS metadata, Goofy web projects, Meego/test artifacts, repository ownership, or code-related Q&A and a natural-language answer is preferred. Do not use it for direct mutations, deployment, approval, or when deterministic structured reads should go to the domain skill instead."
---

# bytedcli BitsAI

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

参考来源：[bitsai-engineering-navigator](https://skills.bytedance.net/skill/skills:skills.byted.org/default/public/bitsai-engineering-navigator)；作者：`yangyi.21@bytedance.com`；已获得作者授权。

## When to use

- 回答字节内部研发知识问答，例如平台能力、适用场景、概念对比、上下游关系
- 回答跨系统研发资产问答，例如 Bits 发布单、开发任务、项目、需求、仓库、MR、人员之间的关系
- 查询 TCE / TCC / FaaS / Goofy 项目的自然语言元信息，例如负责人、控制面、泳道环境、关联仓库
- 回答“我最近……”类研发数据问题，例如最近上线了哪些发布单、最近完成了哪些开发任务、最近写了哪些测试用例
- 回答仓库/代码相关自然语言问题，尤其是需要总结、归纳、解释，而不是只要原始字段时

## Do not use

- 不要用于直接执行变更、部署、发版、审批、开权限等操作型请求；这类请求转交对应平台 skill
- 不要用于必须返回精确结构化字段的读取型请求；这类请求优先使用 `bytedance-bits`、`bytedance-tce`、`bytedance-tcc`、`bytedance-codebase`、`bytedance-goofy-deploy` 等分域 skill
- 不要编造 TCE/TCC PSM、FaaS 名称、Goofy appid；只有用户明确给出时才注入上下文

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- BitsAI 专属约定、认证与会话建议：`references/bitsai.md`
- 先确保 bytedcli 已登录，或已注入 ByteCloud JWT
- 需要机器可读输出时，把 `--json` 放在 `bitsai` 前面

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Workflow

### 1. 选择会话模式

- 单轮问答：直接使用 `bitsai ask`
- 连续追问：复用已有 `--conversation-id`
- 长对话：使用 `bitsai interactive`

### 2. 只在用户显式提供项目标识时注入上下文

- TCE：`--tce <psm>`
- TCC：`--tcc <psm>`
- FaaS：`--faas <name>`
- Goofy：`--goofy name=<project>,appid=<id>`

上下文注入适合“这个服务/项目怎么样”“部署了哪些控制面”“负责人是谁”“有哪些泳道环境”这类问题。需要更多模式时读：`references/query-patterns.md`

### 3. 调用 BitsAI

```bash
bytedcli bitsai ask --message "我最近上线了哪些发布单？"
bytedcli bitsai ask --conversation-id <conversation_id> --message "对应的 TCC 配置呢？"
bytedcli bitsai ask --tce "example.service.api" --message "这个 TCE 服务部署了哪些控制面？"
bytedcli bitsai ask --goofy "name=goofy-web,appid=123456" --message "这个前端项目的负责人和代码仓库是什么？"
bytedcli bitsai interactive
```

### 4. 组织最终回答

- 默认用中文回答
- 结论优先，再补必要要点
- 不向最终用户暴露 JWT、内部 endpoint、实现细节
- 如果 BitsAI 结果偏泛，改用对应平台 skill 做精确查询，再汇总给用户

## Notes

- `bitsai ask` 文本模式默认流式输出；`--json` 适合 agent 解析
- 用户在追问时，优先保留同一个 `conversation_id`
- 对于平台知识问答，BitsAI 优先；对于确定性平台查询或执行操作，优先分域 skill

## References

- `references/invocation.md`
- `references/bitsai.md`
- `references/query-patterns.md`
- `references/troubleshooting.md`
- `references/error-handling.md`
