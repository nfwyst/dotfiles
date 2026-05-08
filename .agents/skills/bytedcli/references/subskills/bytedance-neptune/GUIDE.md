---
name: bytedance-neptune
description: "Operate Neptune via bytedcli: list sites/zones, fetch security/stability/rate-limit/dispatch configs for ingress/egress, list lane groups (所有泳道组), list lanes (某个泳道组下的泳道), list PSM resources in a lane (查询泳道下的服务列表), add PSM resources to lanes (在指定泳道下新增服务), and submit Neptune ACL applications. For international control planes (US-TTP/EU-TTP/SGALI), use `neptune acl apply`; for CN/BOE/ByteIntl sites, use `neptune strict-auth apply` with `--site`. Use when tasks mention Neptune governance, ACL apply, strict authorization, stability, dispatch, rate limit, security, lane groups, lanes, listing PSM in lanes, or adding PSM to lanes."
---

# bytedcli Neptune

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

- Neptune 平台：安全/稳定性/限流/调度配置排查
- 同时关注入流量（ingress）与出流量（egress）
- 跨环境（CN/BOE/ByteIntl）排查配置差异
- 提交 ACL 申请：
  - 目标为国际化控制面（US-TTP / EU-TTP / SGALI region）→ 使用 `neptune acl apply`
  - 目标为 CN / BOE / ByteIntl 等国内站点 → 使用 `neptune strict-auth apply`（需指定 `--site`）
- 查询泳道组（lane groups）列表
- 查询某个泳道组下的泳道（lanes）
- 查询泳道下的服务列表（list PSM in lane）
- 在指定泳道下新增服务（add PSM to lane）

## 前置条件

- 使用通用调用方式：`references/invocation.md`
- 需要鉴权的命令先登录：`bytedcli auth login`

## 在 Aime 沙盒中提交 US-TTP / EU-TTP ACL 申请

Aime 沙盒没有 US-TTP/EU-TTP 的 SSO 登录态，直接运行 `neptune acl apply` 会得到 **HTTP 401**。
绕过方式：让用户在浏览器中手动获取对应控制面的 JWT，通过环境变量注入。

### 操作步骤

**第一步：让用户获取 JWT**

在执行 `neptune acl apply --region US-TTP` 或 `--region EU-TTP` 之前，先提示用户：

> 在 Aime 环境下提交 US-TTP/EU-TTP ACL 申请需要手动提供控制面 JWT。
> 请在浏览器中打开以下链接，登录后在开发者工具（F12 → Network）里找到任意请求的 `x-jwt-token` 请求头，把该值发给我：
>
> - **US-TTP**：`https://cloud-ttp-us.bytedance.net`
> - **EU-TTP**：`https://cloud-eu.tiktok-row.net`

**第二步：通过环境变量注入并执行**

拿到 JWT 后，通过 `BYTEDCLI_USER_CLOUD_JWT` 环境变量传入（该变量优先级高于 Aime 注入的 `AIME_USER_CLOUD_JWT`）：

```bash
BYTEDCLI_USER_CLOUD_JWT="<用户提供的JWT>" bytedcli neptune acl apply \
  --caller-psm example.caller.api \
  --caller-cluster default \
  --callee example.callee.api:default:GetFoo \
  --region US-TTP \
  --reason "..."
```

**注意事项**
- JWT 通常有效期为数小时，过期后需要重新获取。
- 用户不需要注销/重新登录本地 bytedcli，JWT 只对本次命令生效。
- 如果同时提交 US-TTP 和 EU-TTP，两个控制面的 JWT 通常不同，需分开执行两次命令并分别传入对应的 JWT。

## Quick start

```bash
# 发现 Neptune 支持的站点（best-effort）
bytedcli neptune list-sites

# 查看某个站点支持的 zones/vregions（best-effort）
bytedcli --site cn neptune list-cp-regions
bytedcli --site boe neptune list-cp-regions
bytedcli --site byteintl neptune list-cp-regions
bytedcli --site i18n-tt neptune list-cp-regions

# 安全配置（method 默认 *；direction 默认 ingress）
bytedcli neptune security --psm example.service.api --cluster default --zone CN --method "*" --direction ingress

# ACL 申请（默认直接提交，输出申请单号与审批链接）
bytedcli neptune acl apply --caller-psm example.caller.api --caller-cluster default --callee example.callee.api:default:GetFoo --region US-TTP --reason "example reason"
bytedcli neptune acl apply --caller-psm example.caller.api --caller-cluster default --callee example.callee.api:default:GetFoo --region US-TTP,US-TTP2 --reason "example reason"
bytedcli neptune acl apply --caller-psm example.caller.api --caller-cluster default --callee example.callee.api:default:GetFoo --region US-TTP,US-TTP2,EU-TTP2 --reason "example reason"

# 稳定性配置
bytedcli neptune stability --psm example.service.api --cluster default --zone CN --direction ingress

# 限流配置（v2 仅对 ingress 生效）
bytedcli neptune rate-limit --psm example.service.api --cluster default --zone CN --direction ingress
bytedcli neptune rate-limit --psm example.service.api --cluster default --zone CN --direction ingress --v2

# 调度配置
bytedcli neptune dispatch --psm example.service.api --cluster default --zone CN --direction ingress

# 严格授权申请（支持重复或逗号分隔 --method / --zone）
bytedcli --site i18n-tt neptune strict-auth apply \
  --caller-psm demo.caller.service \
  --caller-cluster default \
  --callee-psm demo.callee.service \
  --callee-cluster default \
  --method GetProductByID \
  --method MGetProductsByIds \
  --zone SGALI \
  --reason "Need access for demo workflow"

# 使用完整 payload 申请
bytedcli --site i18n-tt neptune strict-auth apply --payload-file /tmp/neptune_strict_auth_payload.json

# 泳道组列表（问：当前有哪些泳道组？）
bytedcli neptune lane-group list
bytedcli neptune lane-group list --page 2 --page-size 20

# 泳道列表（问：某个泳道组下有哪些泳道？）
bytedcli neptune lane list --domain-code domain-adies --zone CN
bytedcli neptune lane list --domain-code domain-adies --zone CN --page 2 --page-size 50

# 查询指定泳道下的服务列表（问：某个泳道下有哪些服务？）
bytedcli neptune psm list --domain-code domain-adies --lane-name lane-adies-canary_online
bytedcli neptune psm list --domain-code domain-adies --lane-name lane-adies-canary_online --zone CN --page 1 --page-size 100

# 在指定泳道下新增服务（问：在某个泳道下新增一个服务？）
bytedcli neptune psm add --domain-code domain-adies --lane-name lane-adies-canary_online --zone CN --resource-psm data.incentive_engine.aweme
bytedcli neptune psm add --domain-code domain-adies --lane-name lane-adies-canary_online --zone CN --resource-psm data.incentive_engine.aweme --logic-unit-name default --resource-type tce --operation-type create

# 切换环境（BOE/ByteIntl/TikTok ROW）
bytedcli --site boe neptune stability --psm your.service.psm --cluster your.cluster --zone BOE --direction egress
bytedcli --site byteintl neptune stability --psm your.psm --cluster default --zone TEXAS --direction ingress
bytedcli --site i18n-tt neptune stability --psm your.service.psm --cluster your.cluster --zone SGALI --direction ingress

# 需要结构化输出时加 --json
bytedcli --json neptune stability --psm example.service.api --cluster default --zone CN
bytedcli --json neptune lane-group list
bytedcli --json neptune lane list --domain-code domain-adies --zone CN
```

## Notes

- 使用全局 `--site` 选择站点（`cn|boe|byteintl|i18n-tt`，默认 `cn`）。Per-service `--neptune-site` is a hidden alias for backward compatibility.
- `--direction` 支持：`ingress|egress`（默认 `ingress`）
- `--zone` 建议显式传入；如不传，默认：`CN(cn/byteintl)`、`BOE(boe)`、`SG(i18n-tt)`；可用 `neptune list-cp-regions` 查看可选值
- `neptune strict-auth apply` 命令：
  - 结构化参数模式要求 `--caller-psm`、`--callee-psm`、`--reason`、至少一个 `--method`，可选 `--caller-cluster`、`--callee-cluster`、`--zone`、`--reviewer`、`--viewer`
  - `--method` 和 `--zone` 支持重复传入或逗号分隔；payload 中会写入 `zones: string[]`
  - 如平台字段超出 CLI flags，使用 `--payload-json` 或 `--payload-file` 传完整 strict authorization payload；raw payload 模式不要混用结构化 flags
- `--page` 和 `--page-size` 用于分页（`--page-count` 和 `--page-num` 是隐藏的兼容别名）
- `neptune lane list` 命令：
  - `--domain-code`: 域名代码（必填）
  - `--group-code`: 组代码（可选，默认同 domain-code）
  - `--zone`: 区域（必填）
  - `--lane-name`: 泳道名称过滤（可选）
  - `--logic-unit-name`: 逻辑单元名称（可选，默认 "default"）
  - `--psm`: PSM 过滤（可选）
- `neptune acl apply` 需要至少一个 `--region` / `--vregion`；支持逗号分隔与多次传参，输入会按顺序 trim 去重。
- `neptune acl apply` 会按控制面自动分组并直接提交 ACL 申请；同一控制面的多个 region 会合并为一次提交，跨控制面会拆分成多次提交。
- 内置 region 到控制面的映射为：`US-TTP/US-TTP2 -> us-ttp (页面域名 https://cloud-ttp-us.bytedance.net，提交网关 https://cloud.tiktok-us.net)`、`EU-TTP/EU-TTP2/USEASTRED -> eu-ttp (页面域名 https://cloud-eu.tiktok-row.net，提交网关 https://bc-iedt-gw.tiktok-eu.net)`、`SGALI -> sg (页面域名 https://cloud.tiktok-row.net，提交网关 https://cloud-i18n.bytedance.net)`；仅支持国际化控制面，CN 不支持，未知 region 会直接报错。
- `--reason` 为必填参数。
- `--zone` 仍可作为兼容别名使用，但会打印一次 deprecation warning，建议迁移到 `--region` / `--vregion`。
- `neptune psm add` 命令：
  - `--domain-code`: 域名代码（必填）
  - `--lane-name`: 泳道名称（必填）
  - `--zone`: 区域（可选，默认：CN 适用于 cn/byteintl，BOE 适用于 boe）
  - `--resource-psm`: 服务 PSM（必填）
  - `--logic-unit-name`: 逻辑单元名称（可选，默认 "default"）
  - `--resource-type`: 资源类型（可选，默认 "tce"）
  - `--is-sub-lane`: 是否为子泳道（可选，默认 false）
  - `--operation-type`: 操作类型（可选，默认 "create"）
- `neptune psm list` 命令：
  - `--domain-code`: 域名代码（必填）
  - `--lane-name`: 泳道名称（必填）
  - `--zone`: 区域（可选，默认：CN 适用于 cn/byteintl，BOE 适用于 boe）
  - `--logic-unit-name`: 逻辑单元名称（可选，默认 "default"）
  - `--page`: 页码（可选，默认 1）
  - `--page-size`: 每页数量（可选，默认 100）

## References

- `references/neptune.md`

## ACL 申请（简化模式）

bytedance-neptune skill 在 `neptune acl apply` 命令之上提供了一层“简化模式”参数整理逻辑，仅发生在 Skill 层，不改变 CLI 的真实行为与入参约束。

**Region 简写支持**

- 当用户用自然语言描述 ACL 申请时，如果只给出控制面/大区简写，Skill 会自动展开为标准 region 列表，并通过 `--region` 传给 CLI：
  - `sg` 或 `sg-ttp` → `SGALI`（控制面 `sg`）
  - `us` 或 `us-ttp` → `US-TTP,US-TTP2`（控制面 `us-ttp`）
  - `eu` 或 `eu-ttp` → `EU-TTP,EU-TTP2,USEASTRED`（控制面 `eu-ttp`）
- 展开后的结果可以用逗号分隔写在单个 `--region` 里，也可以多次传入 `--region`；Skill 会按 CLI 要求做 trim 和去重。

**Callee 格式放宽与补全**

- 推荐显式使用完整 callee 形式 `psm:cluster:method`。
- 若用户输入 `psm:method`（省略 cluster），Skill 会自动补全为 `psm:default:method`。
- 若用户只输入 `psm`，Skill 会自动补全为 `psm:default:*`，并在执行前提示：
  > 将对 `psm:default:*` 的所有方法开放 ACL，是否继续？
  只有在用户确认继续后，才实际执行 `neptune acl apply`。

**Reason 自动生成**

- 当用户仅用自然语言描述用途（例如“联调用”“排查超时”“新功能接入”等），而没有提供完整的 `--reason` 文本时，Skill 会自动拼装规范的 reason：
  - 单个 callee 时：
    `【ACL 申请】<caller-psm>/<caller-cluster> 访问 <callee-psm>/<callee-cluster>:<method>，用途：<用户描述>，region：<展开后的 region 列表>`
  - 多个 callee 时，每个 callee 单独占一行，沿用上述格式。
- Skill 会在执行前把最终的 caller、callee 列表、region 列表和 reason 文本展示给用户确认，再调用 `neptune acl apply`。

**自然语言示例（简化模式）**

> 帮我给 `example.caller.api` 申请访问 `example.callee.api` 的 `GetWarehouse` 接口，在 `sg`，联调用

上面的描述会触发简化模式：Skill 负责完成 region 展开 → callee 格式补全 → reason 生成 → 参数确认 → 执行提交。
