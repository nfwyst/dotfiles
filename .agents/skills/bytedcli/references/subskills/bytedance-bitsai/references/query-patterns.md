# BitsAI Query Patterns

## 单轮问答

```bash
bytedcli bitsai ask --message "Bits AI 有哪些使用场景？"
bytedcli bitsai ask --message "我最近完成了哪些开发任务？"
```

## 连续追问

```bash
bytedcli bitsai create-conversation
bytedcli bitsai ask --conversation-id <conversation_id> --message "a.b.c 这个 TCE 服务部署了哪些控制面？"
bytedcli bitsai ask --conversation-id <conversation_id> --message "对应负责人是谁？"
```

## 项目上下文注入

仅当用户明确给出标识时添加：

```bash
bytedcli bitsai ask --tce "a.b.c" --message "这个服务最近上线了哪些功能？"
bytedcli bitsai ask --tcc "a.b.c" --message "这个配置有哪些泳道环境？"
bytedcli bitsai ask --faas "a.b.c" --message "这个函数的负责人是谁？"
bytedcli bitsai ask --goofy "name=my-web,appid=123456" --message "这个前端项目的控制面和代码仓库是什么？"
```

## 路由建议

- 先用 BitsAI：研发知识问答、跨系统关系问答、自然语言总结
- 改用平台 skill：需要精确字段、结构化列表、原始详情或执行操作
- 常见切换目标：
  - `bytedance-bits`
  - `bytedance-tce`
  - `bytedance-tcc`
  - `bytedance-codebase`
  - `bytedance-goofy-deploy`
  - `bytedance-bam`
