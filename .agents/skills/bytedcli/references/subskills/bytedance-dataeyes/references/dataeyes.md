# Dataeyes

Dataeyes data validation testing capabilities. Refer to the [Dataeyes documentation](https://cloud.tiktok-row.net/docs/product/dataeyes?from=cloud&cdc_fallback=1&region=Singapore-Central&x-bc-region-id=bytedance) for details.

## Commands

### Project Management

**List projects**
```bash
bytedcli dataeyes project list
bytedcli --json dataeyes project list --page 1 --page-size 20
```

**Get project details**
```bash
bytedcli dataeyes project get --project-id 12345
bytedcli --json dataeyes project get --project-id 12345 --detail
```
- 使用 `--detail` 可以获取项目的完整配置和变量信息。

**Create a project**
```bash
bytedcli dataeyes project create --payload-file ./new_project.json
```

**Update a project**
```bash
bytedcli dataeyes project update-config --project-id 12345 --payload-file ./update.json
bytedcli dataeyes project update-config --project-id 12345 --qps 300
bytedcli dataeyes project update-config --project-id 12345 --qps 300 --read-qps 500
```
- 支持更新任意项目配置字段（以 API 支持为准）。
- `--qps` 会同时设置 scan/read/write，`--scan-qps`/`--read-qps`/`--write-qps` 可单独覆盖。
- QPS 快捷参数与 `--payload-file` 不能同时使用。
- Boei18n 示例：`bytedcli --site boe --vregion US-BOE dataeyes project update-config --project-id 12345 --qps 300 --write-qps 500`

**Update validation config (validationConfig)**
```bash
bytedcli dataeyes project update-validation-config --project-id 12345 --payload-file ./validation_config.json
```
- validationConfig 由该接口统一配置。
- 常见字段：writeMode / scanQPS / readQPS / writeQPS / rules。
- 示例（validation_config.json）：
  ```json
  {
    "writeMode": 1,
    "scanQPS": 100,
    "readQPS": 100,
    "writeQPS": 100,
    "rules": [
      { "field": 0, "threshold": 5 },
      { "field": 1, "threshold": 600 },
      { "field": 2, "threshold": 200 },
      { "field": 3, "threshold": 10 }
    ]
  }
  ```
  - field 说明：0 代表运行时间；1 代表已处理数据数量；2 代表不匹配数据数量；3 代表失败数量占比（百分比）。

### Validation & Tasks

**Start validation**
```bash
bytedcli dataeyes validation start --project-id 12345
```
- 启动项目的数据验证测试。
- validationConfig 通过 `project update-validation-config` 统一配置。

**List validation tasks**
```bash
bytedcli dataeyes validation list --project-id 12345
```

**Get validation report**
```bash
bytedcli dataeyes validation get-report --task-id 98765
```
- 获取已完成任务的验证报告。

**Create tasks**
```bash
bytedcli dataeyes task create --project-id 12345
bytedcli dataeyes task create --project-id 12345 --validation
bytedcli dataeyes task create --project-id 12345 --simulate-fix
bytedcli dataeyes task create --project-id 12345 --fix
```
- --validation 用于小流量 validation 任务。
- 正式任务三种模式：仅对比（不加 --fix/--simulate-fix）、对比 + 模拟修复（--simulate-fix）、对比 + 真实修复（--fix）。

**Manage tasks**
```bash
# 获取任务详情
bytedcli dataeyes task get --task-id 98765

# 暂停任务
bytedcli dataeyes task pause --task-id 98765

# 恢复任务
bytedcli dataeyes task continue --task-id 98765

# 终止任务
bytedcli dataeyes task kill --task-id 98765
```

## Notes

- API 访问需要配置相应的 ByteCloud site 和认证信息。
- 如果命令抛出 `Not Found` 或权限错误，请确认传入的 `project-id` 和 `task-id` 是否正确，以及当前登录用户是否有该项目的访问权限。
