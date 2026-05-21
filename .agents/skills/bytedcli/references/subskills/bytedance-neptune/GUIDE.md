---
name: bytedance-neptune
description: "Operate Neptune via bytedcli: list sites/zones, fetch security/stability/rate-limit/dispatch configs for ingress/egress, query ACL gating status (acl-status / strict-auth-status / acl-check 综合判断 caller→callee 能否调通), list lane groups (所有泳道组), list lanes (某个泳道组下的泳道), list PSM resources in a lane (查询泳道下的服务列表), add PSM resources to lanes (在指定泳道下新增服务), and submit Neptune ACL applications. For international control planes (US-TTP/EU-TTP/SGALI), use `neptune acl apply`; for CN/BOE/ByteIntl sites, use `neptune strict-auth apply` with `--site`. Use when tasks mention Neptune governance, ACL apply, strict authorization, stability, dispatch, rate limit, security, lane groups, lanes, listing PSM in lanes, adding PSM to lanes, 判断 ACL 是否开启 / 调用能否通过 / 严格授权状态."
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

# 判断 caller→callee 能否调通（综合 ACL 三层）。优先用这个，单看 security 容易误判
bytedcli --site us-ttp neptune acl-check --caller-psm example.caller.api --caller-cluster default --psm example.callee.api --cluster default --zone US-TTP
bytedcli --site eu-ttp neptune acl-check --caller-psm example.caller.api --caller-cluster default --psm example.callee.api --cluster default --zone EU-TTP
bytedcli --site i18n-tt neptune acl-check --caller-psm example.caller.api --caller-cluster default --psm example.callee.api --cluster default --zone SGALI

# 仅查 zone 级 ACL 总开关（mode=offline 表示该 zone 上 callee 没启用 ACL）
bytedcli --site us-ttp neptune acl-status --psm example.callee.api --cluster default --zone US-TTP

# 仅查服务级严格授权状态（mode=open 表示已启用白名单模式；deleted 表示未启用）
bytedcli --site i18n-tt neptune strict-auth-status --psm example.callee.api --cluster default --zone SGALI

# ACL 申请（默认直接提交，输出申请单号与审批链接）
bytedcli neptune acl apply --caller-psm example.caller.api --caller-cluster default --callee example.callee.api:default:GetFoo --region US-TTP --reason "example reason"
bytedcli neptune acl apply --caller-psm example.caller.api --caller-cluster default --callee example.callee.api:default:GetFoo --region US-TTP,US-TTP2 --reason "example reason"
bytedcli neptune acl apply --caller-psm example.caller.api --caller-cluster default --callee example.callee.api:default:GetFoo --region US-TTP,US-TTP2,EU-TTP2 --reason "example reason"

# 稳定性配置
bytedcli neptune stability --psm example.service.api --cluster default --zone CN --direction ingress

# 已知目标 method 时建议加 --method，可让后端按 method 精确过滤，避免拉全量万级配置
bytedcli neptune stability --psm example.service.api --cluster default --zone CN --direction ingress --method GetFoo

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

## 判断 caller→callee 在某个 zone 能否调通

Neptune ACL 是一个三层判断，单看任何一层都会得出错误结论。推荐**优先用 `acl-check`** 一条命令拿综合 verdict；要拆开看时再分别调三个：

1. **Zone 级 ACL 总开关**：`neptune acl-status`
   - `mode=offline` → 该 zone 上 callee 的 ACL 未启用，所有调用默认放行（与下面两层无关）
   - `mode=online` → ACL 启用，继续看第 2 层
2. **服务级严格授权**：`neptune strict-auth-status`
   - `mode=deleted` → 严格授权未启用，没显式规则也能调
   - `mode=open` → 启用白名单模式，没显式 allow 则被拦截
3. **Caller 级显式规则**：`neptune security`（`acc_ctrl.exist + value.deny`）
   - `exist=true, deny=false` → 显式 allow
   - `exist=true, deny=true` → 显式 deny（永远覆盖前两层）
   - `exist=false` → 无显式规则，落在前两层默认行为上

`acl-check` 输出的 `verdict`：

- `allow` → 前两层 gate 都未启用，默认放行
- `allow-explicit` → 有显式 allow 规则
- `deny-strict` → strict_authorization 已开但 caller 无 allow 规则
- `deny-explicit` → 有显式 deny 规则
- `indeterminate` → 配置矛盾或字段未覆盖到，需要人工去 ByteCloud 网页确认

**站点对照**：

- US-TTP / US-TTP2 → `--site us-ttp`（API 走 `cloud.tiktok-us.net`）
- EU-TTP / EU-TTP2 / USEASTRED → `--site eu-ttp`（API 走 `bc-iedt-gw.tiktok-eu.net`）
- SGALI → `--site i18n-tt`（API 走 `cloud.tiktok-row.net`）
- CN / BOE / ByteIntl → `--site cn|boe|byteintl`

合规区现状（截至 2026-05）：US-TTP / US-TTP2 / EU-TTP / EU-TTP2 默认未启用 ACL（acl/get_status=offline、strict_authorization=deleted），调用默认放行；SGALI 部分服务已启用 strict_authorization=open，新 caller 调用前必须先确认是否在白名单里。

## 查 US-TTP / EU-TTP 合规区配置

US-TTP 和 EU-TTP 是两个独立控制面，跟 CN / BOE / i18n-tt 走的是不同的 API gateway 和 JWT 链路。CLI 已经做了透明封装，**只要选对 `--site`、传对 `--zone`，security / stability / rate-limit / dispatch / acl-status / strict-auth-status / acl-check 这些查询命令都能用**。

**`--site` 与 zone 对应关系**：

| 控制面                     | `--site`                   | 可选 zone                        | UI host（浏览器看的）        | API host（CLI 实际打的）   |
| -------------------------- | -------------------------- | -------------------------------- | ---------------------------- | -------------------------- |
| US-TTP（BDEE / USTS 公用） | `us-ttp`                   | `US-TTP`, `US-TTP2`              | `cloud-ttp-us.bytedance.net` | `cloud.tiktok-us.net`      |
| EU-TTP                     | `eu-ttp`                   | `EU-TTP`, `EU-TTP2`, `USEASTRED` | `cloud-eu.tiktok-row.net`    | `bc-iedt-gw.tiktok-eu.net` |
| SGALI                      | `i18n-tt`（不是 `eu-ttp`） | `SGALI`                          | `cloud.tiktok-row.net`       | 同左                       |

**常见姿势**：

```bash
# 查 US-TTP 上某 callee 的 ingress security 配置
bytedcli --site us-ttp neptune security \
  --psm example.service.callee --cluster default \
  --zone US-TTP --method "*" --direction ingress --json

# 同一个 callee 在 EU-TTP2 的配置
bytedcli --site eu-ttp neptune security \
  --psm example.service.callee --cluster default \
  --zone EU-TTP2 --method "*" --direction ingress --json

# 判断 caller 现在能否调通 callee —— 优先用 acl-check
bytedcli --site us-ttp neptune acl-check \
  --caller-psm example.service.caller --caller-cluster default \
  --psm example.service.callee --cluster default --zone US-TTP

bytedcli --site eu-ttp neptune acl-check \
  --caller-psm example.service.caller --caller-cluster default \
  --psm example.service.callee --cluster default --zone EU-TTP

# 拆开看两层 gate
bytedcli --site us-ttp neptune acl-status --psm example.service.callee --cluster default --zone US-TTP
bytedcli --site us-ttp neptune strict-auth-status --psm example.service.callee --cluster default --zone US-TTP
```

**关键易踩的坑**：

- **不要走 `--site i18n-tt --zone US-TTP/EU-TTP` 这条路**。i18n-tt 控制面虽然 `list-cp-regions` 会列出这两个 zone，但拿到的是"远端摘要"，数据跟 US-TTP / EU-TTP 真实控制面**不一致**。要查 US-TTP 必须 `--site us-ttp`，要查 EU-TTP 必须 `--site eu-ttp`。
- **CLI 拿到的数据 = 网页上 `rules/security/ingress` 的原始 XHR**，跟 ByteCloud 网页那个"展开后显示 Allow + Effective"的 UI 综合视图**不是同一个东西**。`security` 命令里 `exist=false` 在 ACL 未启用的 zone 不代表"被拒"，而是"无显式规则 + 默认放行"。要拿"能不能调通"的最终结论用 `acl-check`，别只看 `security`。
- US-TTP / EU-TTP 都用 ByteDance SSO 换 JWT（不是 TikTok SSO）。本地 `bytedcli auth login` 登好就行，不需要额外操作。在 Aime 沙盒里跑 `acl apply` 需要手动注入 JWT（见上文「在 Aime 沙盒中提交 US-TTP / EU-TTP ACL 申请」段落）；**查询命令（security / acl-status / strict-auth-status / acl-check）目前没适配 Aime JWT 注入**，仅在本机有 SSO 登录态时可用。

## Notes

- 使用全局 `--site` 选择站点（`cn|boe|byteintl|i18n-tt|us-ttp|eu-ttp`，默认 `cn`）。Per-service `--neptune-site` is a hidden alias for backward compatibility.
- `--direction` 支持：`ingress|egress`（默认 `ingress`）
- `neptune stability` 命令：
  - `--method <method>`（可选）：精确匹配的 server-side filter，不支持 glob；目标 method 已知时强烈建议传入，可把 ~10k 条 / 17 MB 量级响应缩到几十条 / KB 量级（后端只接受 method 这一项 server-side filter，caller psm/cluster 不会被后端识别；如需按 caller 过滤请在调用方做客户端过滤）
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
  > 只有在用户确认继续后，才实际执行 `neptune acl apply`。

**Reason 自动生成**

- 当用户仅用自然语言描述用途（例如“联调用”“排查超时”“新功能接入”等），而没有提供完整的 `--reason` 文本时，Skill 会自动拼装规范的 reason：
  - 单个 callee 时：
    `【ACL 申请】<caller-psm>/<caller-cluster> 访问 <callee-psm>/<callee-cluster>:<method>，用途：<用户描述>，region：<展开后的 region 列表>`
  - 多个 callee 时，每个 callee 单独占一行，沿用上述格式。
- Skill 会在执行前把最终的 caller、callee 列表、region 列表和 reason 文本展示给用户确认，再调用 `neptune acl apply`。

**自然语言示例（简化模式）**

> 帮我给 `example.caller.api` 申请访问 `example.callee.api` 的 `GetWarehouse` 接口，在 `sg`，联调用

上面的描述会触发简化模式：Skill 负责完成 region 展开 → callee 格式补全 → reason 生成 → 参数确认 → 执行提交。
