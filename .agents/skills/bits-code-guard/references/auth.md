# 凭据获取

获取 `CLOUD_JWT` / `CODEBASE_JWT` 两种认证凭据。认证凭据为敏感信息，未经用户明确要求，严禁回显原始凭据内容。

## 前置依赖

确认登录状态：

```bash
skills get-jwt
```

如果命令执行失败（提示未登录或未安装），先安装：

```bash
npm -y i skills -g --registry=https://bnpm.byted.org
```

## 获取 Token

Skill 内的脚本（`scripts/codebase.py`、`scripts/start.py`、`scripts/finish.py`）已内置自动获取逻辑，默认场景下**无需手动 export**，直接调用脚本即可。

仅在需要覆盖（例如使用其他账号的 token）或调试时手动获取：

```bash
# Cloud JWT
export CLOUD_JWT=$(skills get-jwt)

# Codebase JWT（专用命令，与 Cloud JWT 不同）
export CODEBASE_JWT=$(skills get-codebase-jwt)
```

- `CLOUD_JWT`：用于 Cloud 相关 API 调用
- `CODEBASE_JWT`：用于 Codebase OpenAPI 调用（参见 `references/codebase-api.md`）
