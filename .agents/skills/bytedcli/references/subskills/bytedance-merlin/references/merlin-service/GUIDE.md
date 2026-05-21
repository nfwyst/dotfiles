---
name: merlin-service
description: 查询 merlin, seed 线上服务（Bernard）的配置详情。当用户说"查看线上服务/查询服务配置/Bernard 服务详情/service 信息/部署服务查询"时使用。
---

# 线上服务查询

查询 Merlin 线上服务（Bernard）的配置详情。

## 前置条件

- `bytedcli merlin` 可用
- 知道 `service_id`

```bash
bytedcli merlin --help &>/dev/null || \
  NPM_CONFIG_REGISTRY=http://bnpm.byted.org npx -y @bytedance-dev/bytedcli@latest merlin --help
```

如果出现认证错误（401/403），运行 `bytedcli auth login`。

---

## 查询服务详情

```bash
bytedcli merlin service get --service-id '<service_id>'
```

返回服务的配置详情，包括部署状态、资源配置、端点信息等。

服务 URL 格式：`https://ml.bytedance.net/serviceList/<service_id>`

---

## 关联技能

- `merlin-job-launch`：创建训练任务
- `merlin-recipe-eval-run`：运行评估
