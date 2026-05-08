# 草稿请求/响应类型(TypeScript)

本文件是创建/更新脚本特征与数据源特征草稿时的**字段级 SSOT**。主流程只负责何时调用,字段级规则以此处为准。

所有大整数 ID 字段在 JSON 中使用 `string` 传输,避免精度丢失。

## 公共枚举

```ts
/** 特征值类型 / 参数类型 / 测算 type 字段 */
export enum ValueType {
  Bool       = 1,
  Int        = 2,
  Float      = 3,
  String     = 4,
  List       = 10,
  BoolList   = 11,
  IntList    = 12,
  FloatList  = 13,
  StringList = 14,
  Map        = 20,
  BoolMap    = 21,
  IntMap     = 22,
  FloatMap   = 23,
  StringMap  = 24,
}

/** 变更对象状态 */
export enum ChangeObjectStatus {
  Offline         = 0, // 已删除(软)
  Online          = 1, // 已发布无草稿
  DevWithDraft    = 2, // 未发布有草稿 ← **新建/拷贝时的默认值**
  OnlineWithDraft = 3,
  DevDeploying    = 4,
  OnlineDeploying = 5,
  Down            = 6,
  DownDeploying   = 7,
}

export enum FromType {
  ParamVal   = 1, // 特征包参数
  FeatureVal = 2, // 特征
  ConstVal   = 3, // 常量
}

export enum CacheShareMode {
  Unknown      = 0,
  PkgIsolation = 1,
  PkgShare     = 2,
}

/** 实体类型 */
export enum EntityType {
  Entity = 1,
  Pkg    = 3,
}
```

## 公共结构

```ts
export interface FeatureEntity {
  id?: string;
  code?: string;
  name?: string;
  desc?: string;
  entity_type?: EntityType;
}

export interface FeatureProductionUnit {
  id?: string;
  /** `^[a-z0-9_]+$`,建议 `agent_` 前缀 + 随机后缀 */
  code: string;
  /** 建议 code + "生产单元" */
  name: string;
  desc?: string;
}

export interface FeatureDataSource {
  id: string;                // 必填
  code?: string;             // 形如 `<psm>#<method>`
  name?: string;
  /** 1=HTTP / 2=RPC(最常用) */
  ds_type?: number;
  /** 集群名,默认 `default` */
  cluster_name?: string;
}

export interface FeatureParam {
  id?: string;
  key: string;
  name?: string;
  desc?: string;
  value_type: ValueType;
  status?: ChangeObjectStatus;
}

export interface OutputFeature {
  /** 新建时不传;更新已有特征时必传 */
  id?: string;
  /** 必填,`^[a-z0-9_]+$` */
  code: string;
  name: string;
  feat_value_type: ValueType;
  /** 字符串类特征必须为 `""` */
  default_value: string;
  status: ChangeObjectStatus;  // 新建/更新统一传 2(DevWithDraft)
  feat_desc?: string;
}

export interface CacheConf {
  /** 本 Skill 统一 false */
  enable: boolean;
  ttl?: number;
  prefix?: string;
  key?: string;
  key_type?: FromType;
  id?: string;
  share_mode?: CacheShareMode;
}

export interface OptionalDependencyConf {
  enable: boolean;
}
```

## 脚本特征

```ts
export interface ScriptFeatureProdUnit {
  production_unit: FeatureProductionUnit;
  /** 实体特征必填;集内特征留空 */
  entity?: FeatureEntity;
  feat_params?: FeatureParam[];
  /** 完整脚本内容;更新时与编辑区同步 */
  script_content?: string;
  /** **仅 start/end 之间的片段**,务必以回车结束 */
  script_editable_content: string;
  script_start_line?: number;
  script_end_line?: number;
  output_features: OutputFeature[];  // status=2
  status?: ChangeObjectStatus;
  cache_conf: CacheConf;             // enable=false
  deploying_tk_id?: string;
  optional_dependency_conf?: OptionalDependencyConf;
}

/** 创建脚本特征草稿(feature create-draft --type script) */
export interface CreateScriptProdUnitReq {
  script_feature: ScriptFeatureProdUnit;
  /** 实体特征留空;集内特征填特征集 id */
  pkg_id?: string;
  /** 实体特征=false;集内特征=true */
  from_collect: boolean;
}

/** 更新脚本特征草稿(feature update-rule-conf) */
export interface UpdateScriptProdUnitReq {
  feature_id: string;            // = mm_feature_id
  script_feature: ScriptFeatureProdUnit;
  /** 必须等于 GetScriptProdUnitData.version */
  version: number;
  from_collect?: boolean;
  pkg_id?: string;
}

/** 读取草稿:feature get-rule-conf --load-draft 返回 */
export interface GetScriptProdUnitData {
  script_prod_unit: ScriptFeatureProdUnit;
  version: number;               // 更新时必传回
}
```

### 创建示例(脚本特征 / 实体)
```json
{
  "from_collect": false,
  "pkg_id": "",
  "script_feature": {
    "production_unit": {
      "code": "agent_3rqewf_current_time_unit",
      "name": "3rqewf当前时间生产单元"
    },
    "entity": { "code": "text", "id": "sample-entity-id" },
    "feat_params": [],
    "script_editable_content": "\treturn map[string]any{\n\t\t\"test_current_min\": time.Now().Unix(),\n\t}, nil\n\n",
    "output_features": [
      {
        "status": 2,
        "code": "test_current_min",
        "name": "当前时间",
        "default_value": "-1",
        "feat_value_type": 2
      }
    ],
    "cache_conf": { "enable": false }
  }
}
```

## 数据源特征

```ts
export interface DsFeature {
  ds: FeatureDataSource;
  production_unit: FeatureProductionUnit;
  /** 实体特征必填;集内特征留空 */
  entity?: FeatureEntity;
  /** **必须为 20**(map) */
  feat_value_type: ValueType;
  feat_params?: FeatureParam[];

  /** 完整请求脚本 */
  req_script_content: string;
  /** **仅 start/end 之间的片段**,务必以回车结束 */
  req_script_editable_content: string;
  req_script_start_line: number;
  req_script_end_line: number;

  /** 完整结果脚本 */
  resp_script_content: string;
  /** **仅 start/end 之间的片段**,务必以回车结束 */
  resp_script_editable_content: string;
  resp_script_start_line: number;
  resp_script_end_line: number;

  /** 每条 feat_value_type 必须等于实际输出类型,**不是 20** */
  output_ds_features: OutputFeature[];  // status=2
  status?: ChangeObjectStatus;
  cache_conf: CacheConf;                // enable=false
  deploying_tk_id?: string;
  optional_dependency_conf?: OptionalDependencyConf;
}

/** 创建数据源特征草稿(feature create-draft --type ds) */
export interface CreateDsFeatureReq {
  ds_feature: DsFeature;
  pkg_id?: string;
  from_collect: boolean;
}

/** 更新数据源特征草稿 */
export interface UpdateDsFeatureReq {
  feature_id: string;            // = mm_feature_id
  ds_feature: DsFeature;
  only_diff?: boolean;
  /** 必须等于 GetDsFeatureData.version */
  version: number;
  from_collect?: boolean;
  pkg_id?: string;
}

/** 读取草稿返回 */
export interface GetDsFeatureData {
  ds_feature: DsFeature;
  version: number;
}
```

### 创建示例(数据源特征 / 实体 / RPC)
```json
{
  "from_collect": false,
  "pkg_id": "",
  "ds_feature": {
    "feat_value_type": 20,
    "status": 2,
    "ds": {
      "id": "sample-ds-id",
      "code": "aweme.user.gouser#MultiGetUser",
      "name": "后台服务11",
      "ds_type": 2,
      "cluster_name": "default"
    },
    "entity": { "code": "room", "id": "sample-entity-id" },
    "production_unit": {
      "code": "agent_2043671354108526808992183",
      "name": "agent_2043671354108526808992183生产单元",
      "desc": ""
    },
    "req_script_start_line": 41,
    "req_script_end_line": 43,
    "req_script_content": "package processor\n...\nfunc Process(...){ /*----------start----------*/\n\n    return map[string]any{}, nil\n\n    /*----------end----------*/ }",
    "req_script_editable_content": "\n    return map[string]any{}, nil\n\n",
    "resp_script_start_line": 45,
    "resp_script_end_line": 49,
    "resp_script_content": "package processor\n...\nfunc Process(...){ /*----------start----------*/\n\tif dsErr != nil { return nil, dsErr.(error) }\n\n    return map[string]any{}, nil\n\n    /*----------end----------*/ }",
    "resp_script_editable_content": "\tif dsErr != nil {\n\t\treturn nil, dsErr.(error)\n\t}\n\n    return map[string]any{}, nil\n\n",
    "output_ds_features": [
      {
        "status": 2,
        "code": "test_002",
        "name": "测试002",
        "default_value": "",
        "feat_value_type": 4
      }
    ],
    "cache_conf": { "enable": false }
  }
}
```

## 字段级关键规则速查

| 字段 | 规则 |
|---|---|
| `pkg_id` + `from_collect` + `entity` | 实体:pkg_id=`""`,from_collect=`false`,entity.id/code **必填**;集内:pkg_id=`<集id>`,from_collect=`true`,entity 留空 |
| `production_unit.code` | `agent_` + 随机后缀,符合 `^[a-z0-9_]+$` |
| `production_unit.name` | 建议 code + "生产单元" |
| `*_script_editable_content` | **只含** start/end 之间片段,**务必以回车结束**(创建时以回车结束) |
| `output_features[*].status` / `output_ds_features[*].status` | 统一 `2`(DevWithDraft) |
| `output_features[*].id` | 新建不传;更新已有特征必传(id/code/feat_value_type 不可改);新增项不传 id |
| `ds_feature.feat_value_type` | **必须 20** |
| `output_ds_features[*].feat_value_type` | **对齐实际输出类型**(不是 20) |
| 字符串类 `default_value` | `""` |
| `cache_conf.enable` | `false` |
| `UpdateXxxReq.version` | **必须**来自最近一次 `GetXxxData.version` |
