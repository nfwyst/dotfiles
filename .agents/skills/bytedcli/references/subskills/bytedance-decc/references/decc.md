# DECC (Data Exchange & Cross-region Compute) CLI Reference

DECC provides cross-region data exchange capabilities. The CLI supports creating HDFS channels, registering data (tables), and applying for permissions.

Authentication: all DECC commands use ByteCloud JWT via `--site i18n-tt`.

## Commands

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

## API Endpoints

| Command | Gateway | Endpoint |
|---------|---------|----------|
| `hdfs-channel create` | OpenAPI (`bc-maliva-gw.tiktok-row.net`) | `POST /openapi/channel/create` |
| `hdfs-data create` | OpenAPI (`bc-maliva-gw.tiktok-row.net`) | `POST /openapi/data/create` |
| `apply` | Direct (`decc.tiktok-row.net`) | `POST /decc-next-api/v3/auth/object_user_role/apply` |

## Scenario Reference

| Value | Name | Description |
|-------|------|-------------|
| 0 | UNKNOWN_SCENARIO | Unknown |
| 1 | ALL_SCENARIO | All scenarios |
| 2 | TEXAS | Texas data sovereignty |
| 3 | CLOVER | Clover data sovereignty |
| 4 | CN_CROSS_BORDER | CN cross-border transfer |
| 5 | TT_NONTT | TT & NonTT data isolation |
| 6 | EU_US_DIRECT_CONNECTION | EU-US direct connection |
| 7 | ROW_HDFS_BOE | row-hdfs/boe gateway |
| 8 | ROW_HDFS_PRODUCTION | row-hdfs/prod gateway |
| 9 | RPC_TEXAS_CLOVER_MIXED | RPC Texas/Clover mixed |
| 10 | HDFS_TEXAS_CLOVER_MIXED | HDFS Texas/Clover mixed |
