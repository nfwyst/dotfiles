# Puzzle API Reference

## Base URL

`https://safe.bytedance.net/`

## Authentication

Cookie-based. Headers: `cookie`, `tenant`, `business`, `Agw-Js-Conv: str`.

## Endpoints

| Method                  | HTTP | Path                                        |
| ----------------------- | ---- | ------------------------------------------- |
| GetFeatureList          | POST | /api/puzzle/v1/features                     |
| GetFeatureDetail        | GET  | /api/puzzle/v1/features/{id}/detail         |
| GetFeatureDetailByCode  | POST | /api/puzzle/v1/get_feature_by_code          |
| GetEntities             | GET  | /api/puzzle/v1/entities                     |
| GetEntityDetail         | GET  | /api/puzzle/v1/entities/{id}                |
| GetDSBaseInfoList       | GET  | /api/puzzle/v1/ds_base_infos                |
| GetDataSource           | GET  | /api/puzzle/v1/data_sources/{id}            |
| GetTenantList           | GET  | /api/puzzle/v1/tenants/                     |
| GetPackageList          | POST | /api/puzzle/v1/package_list                 |
| GetPackageDetail        | GET  | /api/puzzle/v2/packages/{id}                |
| GetCollectionList       | POST | /api/puzzle/v2/collection_list              |
| GetCollectionDetail     | GET  | /api/puzzle/v2/collections/{id}             |
| CreateDataSource        | POST | /api/puzzle/v1/data_sources                 |
| GetServiceClusterInfo   | GET  | /api/puzzle/v1/service_infos/{psm}/clusters |
| FeatureListDependencies | GET  | /api/puzzle/v1/case_test/feature/{id}       |
| FeatureTest             | POST | /api/puzzle/v1/case_test                    |
| FeatureCreateDraft(ds)  | POST | /api/puzzle/v1/ds_features                  |
| FeatureCreateDraft(scr) | POST | /api/puzzle/v1/script_production_unit       |
| GenerateScriptTemplate  | POST | /api/puzzle/v1/scripts/content/generate     |
| AnalyseScriptRelations  | POST | /api/puzzle/v1/scripts/content/analyse      |
| CreateTicket            | POST | /api/puzzle/v1/tickets                      |

## Response Format

```json
{ "code": 0, "message": "success", "data": { ... } }
```
