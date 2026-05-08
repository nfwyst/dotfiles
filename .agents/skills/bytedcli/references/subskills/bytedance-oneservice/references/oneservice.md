# OneService CLI Reference

The OneService CLI provides read-only access to query metadata, query version detail, and SQL extraction from the current ONLINE version.

## Commands

### meta get

Get OneService query metadata by query id.

```bash
bytedcli oneservice meta get --id <queryId>
```

**Options:**
- `--id <queryId>` - OneService query id (required)

**Examples:**
```bash
bytedcli oneservice meta get --id 7540220100792550450
bytedcli --json oneservice meta get --id 7261469813564769335
```

**Output:**
- Query name, owner, path, project/folder information
- Query type and other metadata returned by `/invoker_server/api/v1/query/`

---

### detail get

Get full OneService query version detail by version id.

```bash
bytedcli oneservice detail get --id <versionId>
```

**Options:**
- `--id <versionId>` - OneService query version id (required)

**Examples:**
```bash
bytedcli oneservice detail get --id 7543499614608016410
bytedcli --json oneservice detail get --id 7573586773255799871
```

**Output:**
- Full query version payload
- Commonly includes `version.param_info.sqlText`

---

### sql get

Resolve the current ONLINE query version from a query id, then return its SQL text.

```bash
bytedcli oneservice sql get --id <queryId>
```

**Options:**
- `--id <queryId>` - OneService query id (required)

**Examples:**
```bash
bytedcli oneservice sql get --id 7626253820271625242
bytedcli --json oneservice sql get --id 7626253820271625242
```

**Behavior:**
1. Calls `/invoker_server/api/v1/query_version/list?queryId=<queryId>`
2. Selects the first version whose `status` contains `ONLINE`
3. Calls `/invoker_server/api/v1/query_version/<versionId>`
4. Returns `version.param_info.sqlText`

**Failure modes:**
- `ONESERVICE_AUTH_ERROR`: missing or expired SSO browser session
- `ONESERVICE_VERSION_MISSING`: no `ONLINE` version found for the query
- `ONESERVICE_SQL_MISSING`: version detail does not contain `sqlText`

## Authentication

OneService requires a valid browser session cookie for the selected site. By default (`cn`) it uses the CN OneService endpoint; with `--site i18n-tt` it uses the i18n-tt OneService endpoint.

```bash
bytedcli auth login --session
bytedcli --site i18n-tt auth login --session
```

ByteCloud JWT alone is not sufficient for these endpoints.
