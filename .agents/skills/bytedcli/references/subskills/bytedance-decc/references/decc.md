# DECC (Data Exchange & Cross-region Compute) CLI Reference

DECC provides cross-region data exchange capabilities. The CLI supports create/update OG tagging, creating HDFS channels, registering data (tables), and applying for permissions.
It also supports inspecting DECC ticket comments by ticket ID.

Authentication: all DECC commands use ByteCloud JWT via `--site i18n-tt`.

## Commands

### gateway service list

List or search DECC Gateway services(psm), typically to find the service entity ID for the psm that owns the api you want to tag.

```bash
bytedcli --site i18n-tt decc gateway service list [options]
```

**Options:**

- `--name <name>` — Filter by psm
- `--region <regions>` — Comma-separated compliance regions: `EU`, `US`, `EU,US`, or `US,EU`
- `--owners <owners>` — Comma-separated owner usernames; values are OR filters
- `--source-type <sourceType>` — Source type: `Web`, `Log`, `Metric`, or `CommonHeader`
- `--page <n>` — Page number, 1-based (default: `1`)
- `--page-size <n>` — Page size (default: `20`)

**Examples:**

```bash
# List services
bytedcli --site i18n-tt decc gateway service list

# Search by name
bytedcli --site i18n-tt decc gateway service list \
  --name demo.api_service

# Filter by region, owners, and source type
bytedcli --site i18n-tt decc gateway service list \
  --region EU,US \
  --owners demo.user,sample.user \
  --source-type CommonHeader
```

### gateway endpoint list

List the API endpoints under a DECC Gateway service entity (PSM).

```bash
bytedcli --site i18n-tt decc gateway endpoint list [options]
```

**Options:**

- `--entity-id <entityId>` (required) — DECC Gateway service entity ID
- `--stage <stage>` (required) — Endpoint stage: `approved` or `draft`
- `--page <n>` — Page number, 1-based (default: `1`)
- `--page-size <n>` — Page size (default: `20`)

**Examples:**

```bash
# List draft endpoints for a service entity
bytedcli --site i18n-tt decc gateway endpoint list \
  --entity-id demo-service-entity-id \
  --stage draft \
  --page 1 \
  --page-size 15
```

### gateway endpoint get

Get a DECC Gateway API endpoint, including its ID, description, and tagged fields.

```bash
bytedcli --site i18n-tt decc gateway endpoint get [options]
```

**Options:**

- `--id <id>` (required) — DECC Gateway endpoint ID
- `--stage <stage>` (required) — Endpoint stage: `approved` or `draft`

**Examples:**

```bash
# Get a draft endpoint
bytedcli --site i18n-tt decc gateway endpoint get \
  --id demo-endpoint-id \
  --stage draft
```

### gateway endpoint create

Create a DECC Gateway endpoint draft. When `--owners` is omitted, the operator is used as the owner.

```bash
bytedcli --site i18n-tt decc gateway endpoint create [options]
```

**Options:**

- `--entity-id <entityId>` (required) — DECC Gateway service entity ID
- `--path <path>` (required) — HTTP path
- `--method <method>` (required) — HTTP method
- `--description <description>` (required) — Endpoint description
- `--owners <owners>` — Comma-separated owner usernames; defaults to the operator

**Examples:**

```bash
# Create a draft endpoint owned by the current operator
bytedcli --site i18n-tt decc gateway endpoint create \
  --entity-id demo-service-entity-id \
  --path /demo/api \
  --method GET \
  --description "demo endpoint"

# Create a draft endpoint with explicit owners
bytedcli --site i18n-tt decc gateway endpoint create \
  --entity-id demo-service-entity-id \
  --path /demo/api \
  --method POST \
  --description "demo endpoint" \
  --owners demo.user,sample.user
```

### gateway endpoint update

Update the details of a DECC Gateway API endpoint draft, including tagging its fields.

```bash
bytedcli --site i18n-tt decc gateway endpoint update [options]
```

**Options:**

- `--draft-id <draftId>` (required) — DECC Gateway endpoint draft ID
- `--description <description>` — Endpoint description; defaults to the current draft detail description when omitted
- `--query-file <path>` — Query params field array file
- `--path-file <path>` — Path params field array file
- `--req-headers-file <path>` — Request headers field array file
- `--req-body-file <path>` — Request body field array file
- `--resp-headers-file <path>` — Response headers field array file
- `--resp-body-file <path>` — Response body field array file

The field-array files contain JSON arrays whose entries use `fieldName`, `type`, optional `description`, optional `compliance_tag`, and optional nested `children`. The CLI converts arrays to the map shape expected by DECC Gateway.

**Examples:**

```bash
# Update draft description and request schema from local JSON files
bytedcli --site i18n-tt decc gateway endpoint update \
  --draft-id demo-endpoint-id \
  --description "updated demo endpoint" \
  --req-headers-file req_headers.json \
  --req-body-file req_body.json

# Update response schema from local JSON files
bytedcli --site i18n-tt decc gateway endpoint update \
  --draft-id demo-endpoint-id \
  --resp-headers-file resp_headers.json \
  --resp-body-file resp_body.json
```

### hdfs-channel create

Create a new DECC HDFS channel (endpoint).

```bash
bytedcli --site i18n-tt decc hdfs-channel create [options]
```

**Options:**

- `--name <name>` (required) — Channel name (database name)
- `--description <description>` (required) — Channel description
- `--owners <owners>` (required) — Comma-separated owner usernames
- `--vgeo-list <vgeoList>` (required) — Comma-separated vGeo regions: `ROW-TT`, `NonTT`, `US`, `EU`, `CN`
- `--scenario <scenario>` — Comma-separated scenario types (default: `4` = CN_CROSS_BORDER)

**Examples:**

```bash
# Create a channel with CN vGeo
bytedcli --site i18n-tt decc hdfs-channel create \
  --name demo-database \
  --description "demo channel for cross-region exchange" \
  --owners demo.user \
  --vgeo-list CN \
  --scenario 4

# Create a channel with multiple vGeos
bytedcli --site i18n-tt decc hdfs-channel create \
  --name demo-multi-region \
  --description "multi-region channel" \
  --owners demo.user1,demo.user2 \
  --vgeo-list CN,US,EU \
  --scenario 3
```

### hdfs-data create

Register a new DECC HDFS data (table) under a channel.

```bash
bytedcli --site i18n-tt decc hdfs-data create [options]
```

**Options:**

- `--channel-id <channelId>` (required) — DECC channel/endpoint ID
- `--name <name>` (required) — Data name (table name)
- `--owners <owners>` (required) — Comma-separated owner usernames
- `--region <region>` (required) — Source DECC region
- `--scenario <scenario>` — Comma-separated scenario types (default: `3` = CLOVER)

**Supported regions:** `Singapore-Central`, `EU-TTP2`, `US-EastRed`, `EU-Compliance2`, `US-TTP`, `Asia-SouthEastBD`, `Asia_Saas`, `Singapore_Saas`, `Asia_CIS`

**Examples:**

```bash
# Register a table under a channel
bytedcli --site i18n-tt decc hdfs-data create \
  --channel-id 7252920295022035206 \
  --name demo_table_name \
  --owners demo.user \
  --region EU-TTP2

# Register with explicit scenario
bytedcli --site i18n-tt decc hdfs-data create \
  --channel-id 7252920295022035206 \
  --name demo_another_table \
  --owners demo.user1,demo.user2 \
  --region US-TTP \
  --scenario 2
```

### apply

Apply for channel or data Owner permission. The role is inferred from `--object-type`: 1 → Channel Owner, 2 → Data Owner.

```bash
bytedcli --site i18n-tt decc apply [options]
```

**Options:**

- `--object-type <objectType>` (required) — Object type: `1` = channel, `2` = data
- `--object-key <objectKey>` (required) — Channel ID or Data ID
- `--users <users>` (required) — Comma-separated usernames to grant permission
- `--reason <reason>` (required) — Reason for the permission request

**Examples:**

```bash
# Apply for channel Owner
bytedcli --site i18n-tt decc apply \
  --object-type 1 \
  --object-key 7252920295022035206 \
  --users demo.user \
  --reason "Need channel access for data exchange"

# Apply for data Owner
bytedcli --site i18n-tt decc apply \
  --object-type 2 \
  --object-key 7314310435141632262 \
  --users demo.user \
  --reason "Need data access for pipeline"

# Apply for multiple users
bytedcli --site i18n-tt decc apply \
  --object-type 1 \
  --object-key 7252920295022035206 \
  --users demo.user1,demo.user2 \
  --reason "Team needs channel access"
```

**Output:** On success, returns a permission ticket URL for tracking the approval process.

### ticket comment

List comments for a DECC ticket.

```bash
bytedcli --site i18n-tt decc ticket comment [options]
```

**Options:**

- `--ticket-id <ticketId>` (required) — DECC ticket ID

**Examples:**

```bash
bytedcli --site i18n-tt decc ticket comment \
  --ticket-id demo-ticket-id

bytedcli --site i18n-tt --json decc ticket comment \
  --ticket-id demo-ticket-id
```

**Output:** Text mode prints a compact comment table. JSON mode returns the parsed comments and raw response payload.

## API Endpoints

| Command                   | Gateway                                 | Endpoint                                             |
| ------------------------- | --------------------------------------- | ---------------------------------------------------- |
| `gateway service list`    | Direct unified API                      | `GET /unified_api/v2/services/list`                  |
| `gateway endpoint list`   | Direct unified API                      | `GET /unified_api/v2/endpoints/list`                 |
| `gateway endpoint get`    | Direct unified API                      | `GET /unified_api/v2/endpoints/detail`               |
| `gateway endpoint create` | Direct unified API                      | `POST /unified_api/v2/endpoint/draft/create`         |
| `gateway endpoint update` | Direct unified API                      | `POST /unified_api/v2/endpoint/draft/update`         |
| `hdfs-channel create`     | OpenAPI (`bc-maliva-gw.tiktok-row.net`) | `POST /openapi/channel/create`                       |
| `hdfs-data create`        | OpenAPI (`bc-maliva-gw.tiktok-row.net`) | `POST /openapi/data/create`                          |
| `apply`                   | Direct (`decc.tiktok-row.net`)          | `POST /decc-next-api/v3/auth/object_user_role/apply` |
| `ticket comment`          | Direct (`decc.tiktok-row.net`)          | `GET /api/v2/comment/list`                           |

## Scenario Reference

| Value | Name                    | Description               |
| ----- | ----------------------- | ------------------------- |
| 0     | UNKNOWN_SCENARIO        | Unknown                   |
| 1     | ALL_SCENARIO            | All scenarios             |
| 2     | TEXAS                   | Texas data sovereignty    |
| 3     | CLOVER                  | Clover data sovereignty   |
| 4     | CN_CROSS_BORDER         | CN cross-border transfer  |
| 5     | TT_NONTT                | TT & NonTT data isolation |
| 6     | EU_US_DIRECT_CONNECTION | EU-US direct connection   |
| 7     | ROW_HDFS_BOE            | row-hdfs/boe gateway      |
| 8     | ROW_HDFS_PRODUCTION     | row-hdfs/prod gateway     |
| 9     | RPC_TEXAS_CLOVER_MIXED  | RPC Texas/Clover mixed    |
| 10    | HDFS_TEXAS_CLOVER_MIXED | HDFS Texas/Clover mixed   |
