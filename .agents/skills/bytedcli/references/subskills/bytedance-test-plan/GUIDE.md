---
name: bytedance-test-plan
description: 获取 Bits 测试计划用例。当用户贴了 bits.bytedance.net 包含 quality/plan、quality/case、quality/testPlan 的链接，或说"获取测试用例"、"拿测试用例"、"fetch test case"时触发。解析脑图 + LeafInfo，输出 Markdown 到 .testcase/ 目录。
---

# bytedcli Test Plan

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

- 用户贴了 `bits.bytedance.net` 包含 `quality/plan`、`quality/case` 或 `quality/testPlan` 的链接
- 用户说"获取测试用例"、"拿测试用例"、"fetch test case" 等

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要 bytedcli 认证（SSO 登录态）

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 最简方式：直接传 Bits URL，自动识别 caseDetail / manualTask 路由
bytedcli test-plan get \
  --url "https://bits.bytedance.net/devops/1500026370/quality/case/caseDetail/13542569?devops_space_old_id=2020093641"

# 获取测试计划脑图数据，解析后保存为 Markdown
bytedcli test-plan mind get \
  --test-plan-id 13365830 \
  --space-id 1500026370

# 获取单个用例详情
bytedcli test-plan case get \
  --case-id 13542569 \
  --space-id 1500026370

# 指定 projectId（避免额外查询）
bytedcli test-plan mind get \
  --test-plan-id 13365830 \
  --space-id 1500026370 \
  --project-id 2020093641

# 仅获取 LeafInfo（不返回脑图）
bytedcli test-plan mind get \
  --test-plan-id 13365830 \
  --space-id 1500026370 \
  --ignore-case-mind

# 指定输出目录
bytedcli test-plan mind get \
  --test-plan-id 13365830 \
  --space-id 1500026370 \
  --output-dir ./my-testcases

# 通过 spaceId 查询 projectId
bytedcli test-plan project get --space-id 1500026370
```

## Notes

- 推荐使用 `test-plan get --url` 直接传 Bits 页面链接，自动识别路由类型
- `manualTask/{id}` 才是 TestPlanId，不是 `planDetail/{id}`
- 需要结构化输出加 `--json`

## References

- `references/test-plan.md`
- `references/api-response.md`
