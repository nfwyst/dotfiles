# 芒果模块 GraphQL 规则

当需要查看某个应用模块默认会使用哪些 GraphQL 规则时，读取本文件。

## 命令

```bash
bytedcli mango module graphql-rule list --space-id 6 --module demo_module
bytedcli --json mango module graphql-rule list --space-id 6 --module demo_module
```

参数：

| CLI 参数            | 说明                                   | 是否必传 |
| ------------------- | -------------------------------------- | -------- |
| `--space-id <id>`   | 芒果空间 ID，来自 `mango space list`。 | 是。     |
| `--module <module>` | 应用模块，来自 `mango app list`。      | 是。     |

## 输出

文本输出展示：

| 字段        | 含义               |
| ----------- | ------------------ |
| `Module`    | 当前查看的模块名。 |
| `Rule type` | 规则类型。         |
| `Key`       | 规则 key。         |
| `Name`      | 规则名称。         |
| `Total`     | 规则数量。         |

示例：

```text
Module: demo_module
Rule type: developer

Mango Module GraphQL Rules
 Key                    Name
 SceneOuterStruct       接口返回通用规则
 SceneRespInt64ToStr    i64转为string
Total: 2
```

需要给 Agent 或脚本消费完整数据时使用 `--json`。

## 使用建议

- 录入接口前，如果不确定模块默认规则，可以先执行 `mango module graphql-rule list`。
- 常规录入接口时不需要手动复制这些规则；只在需要覆盖规则时，才在 `--methods` JSON 中传 `AgwTemplateRules`。
