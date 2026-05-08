# Test Plan

## 通过 URL 获取测试用例（推荐）

```bash
# 直接传 Bits 页面 URL，自动识别 caseDetail / manualTask 路由
bytedcli test-plan get \
  --url "https://bits.bytedance.net/devops/1500026370/quality/case/caseDetail/13542569?devops_space_old_id=2020093641"

bytedcli test-plan get \
  --url "https://bits.bytedance.net/devops/1500026370/quality/plan/scenarios/planDetail/123/manualTask/13365830"

# 指定输出目录
bytedcli test-plan get \
  --url "https://bits.bytedance.net/devops/1500026370/quality/case/caseDetail/13542569" \
  --output-dir ./my-testcases

# JSON 输出
bytedcli --json test-plan get \
  --url "https://bits.bytedance.net/devops/1500026370/quality/case/caseDetail/13542569"
```

## 获取测试计划脑图

```bash
# 获取测试计划脑图 + LeafInfo，解析后保存 Markdown 到 .testcase/
bytedcli test-plan mind get \
  --test-plan-id 13365830 \
  --space-id 1500026370

# 指定 projectId（避免额外查询）
bytedcli test-plan mind get \
  --test-plan-id 13365830 \
  --space-id 1500026370 \
  --project-id 2020093641

# 仅获取 LeafInfo，不返回脑图
bytedcli test-plan mind get \
  --test-plan-id 13365830 \
  --space-id 1500026370 \
  --ignore-case-mind

# 指定输出目录
bytedcli test-plan mind get \
  --test-plan-id 13365830 \
  --space-id 1500026370 \
  --output-dir ./my-testcases

# JSON 输出（不保存文件，直接返回 API 数据）
bytedcli --json test-plan mind get \
  --test-plan-id 13365830 \
  --space-id 1500026370
```

## 获取单个用例详情

```bash
# 通过 caseId 获取用例详情，渲染为 Markdown
bytedcli test-plan case get \
  --case-id 13542569 \
  --space-id 1500026370

# 指定 projectId
bytedcli test-plan case get \
  --case-id 13542569 \
  --space-id 1500026370 \
  --project-id 2020093641

# JSON 输出
bytedcli --json test-plan case get \
  --case-id 13542569 \
  --space-id 1500026370
```

## 查询 projectId

```bash
# 通过 spaceId 查询 projectId
bytedcli test-plan project get --space-id 1500026370

# JSON 输出
bytedcli --json test-plan project get --space-id 1500026370
```

## URL 参数提取

常见 URL 格式：

| 类型 | URL 模式 |
|------|---------|
| 用例详情 | `https://bits.bytedance.net/devops/{spaceId}/quality/case/caseDetail/{caseId}` |
| 测试计划 | `https://bits.bytedance.net/devops/{spaceId}/quality/plan/scenarios/planDetail/{planId}/manualTask/{testPlanId}` |

| 参数 | URL 位置 | 示例 |
|------|---------|------|
| `spaceId` | `/devops/{spaceId}/quality/...` | `1500026370` |
| `caseId` | `caseDetail/{id}` | `13542569` |
| `testPlanId` | `manualTask/{id}` | `13365830` |
| `projectId` | query `devops_space_old_id` | `2020093641`（常缺失） |

注意：`manualTask/{id}` 才是 TestPlanId，不是 `planDetail/{id}`。

## Notes

- `--project-id` 可选；缺省时自动通过 `--space-id` 查询
- `--ignore-case-mind` 不返回脑图但仍返回 LeafInfo
- `--output-dir` 默认 `.testcase`
- `--json` 模式下直接返回 API 原始数据，不保存文件
