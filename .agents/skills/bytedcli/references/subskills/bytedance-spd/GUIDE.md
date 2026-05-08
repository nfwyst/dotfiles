---
name: bytedance-spd
description: "Operate ByteDance SPD (Security Privacy Data) platform via bytedcli. Map BAM services to SPD PSMs, import and parse IDL files, and annotate methods and field-paths for security and privacy compliance."
---

# bytedcli SPD

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

- 查询 BAM service 对应的 SPD 真实 `psm_id`
- 批量添加 PSM 至 SPD
- 导入 IDL 文件到现有的 PSM
- 解析 IDL 以获取方法和响应结构体等元数据
- 更新方法属性（如标定是否为后置管控等）
- 更新特定字段路径的注解（如在响应体上添加 `method_auth` 类型标签）
- 一键完成导入、解析、以及字段与方法的注解编排（`import-parse-annotate`）

## 前置条件

- 使用通用调用方式：`references/invocation.md`

> 执行前缀见 `references/invocation.md`；下面示例直接写 `bytedcli`。

## Quick start

```bash
# 查询 BAM service 对应的真实 SPD psm_id（避免把 BAM service_id 当成 psm_id）
bytedcli spd get-psms --service "sample-service" --service-mode online

# 批量添加 PSM
bytedcli spd batch-add-psms --psms "sample1.psm,sample2.psm" --service "sample-service"

# 更新 method attr（method-type 必填，比如传 1 表示后置管控）
bytedcli spd update-method-attr --psm-id 123 --psm "sample.psm" --method-name "GetSample" --method-type 1

# 更新 field-path annotations（label-id / label-type 必填且为整数）
bytedcli spd update-field-path-annotations --psm-id 123 --psm "sample.psm" --method-name "GetSample" --service "sample-service" --field-path "SampleResp" --annotation-type 3 --label-id 71 --label-type 1

# 导入与解析 IDL
bytedcli spd import-idl --psm-id 123 --psm "sample.psm" --repo "git@code.byted.org:sample/group.git" --path "idl/sample.thrift" --service "sample-service"
bytedcli spd parse-idl --psm-id 123 --psm "sample.psm"

# 一键编排：import -> parse -> update-method-attr -> update-field-path-annotations
# 如果不传 --field-path，该命令会自动从 parse-idl 结果中提取对应的响应结构体名称进行打标
bytedcli spd import-parse-annotate --psm-id 123 --psm "sample.psm" --repo "git@code.byted.org:sample/group.git" --path "idl/sample.thrift" --service "sample-service" --method-name "GetSample" --method-type 1 --annotation-type 3 --label-id 71 --label-type 1
```

## Important Notices

- **psm_id 区别**：BAM 的 `service_id` 和 SPD 的 `psm_id` 是两个完全不同的体系。必须先调取 `spd get-psms` 获取真实的 `psm_id` 用于后续调用。
- **强制类型校验**：`label-id`、`label-type`、`method-type` 和 `annotation-type` 必须为 Integer（传 String 会导致 400 Bad Request）。
- **结构体打标**：Response 的真实结构体名称并不能简单靠拼接产生（可能是不规范的名称如 `ItemResp` 或 `CommonBaseResp`）。推荐使用一键编排命令 `import-parse-annotate`，其能够通过内嵌的 parse-idl 自动拉取真实的 struct 名字进行标注。
- SPD API 需要鉴权，底层会使用配置中的 `bytecloudJwtToken`。
