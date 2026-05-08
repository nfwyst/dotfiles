# ByteDog Authentication

ByteDog API requires a ByteCloud JWT token for authentication. The `bytedcli bytedog` commands handle JWT acquisition and injection automatically via the global `--site` option.

## Authentication is automatic

When using `bytedcli bytedog` commands, authentication is handled internally. Just pass `--site <site>` to select the correct site:

```bash
# CN site (default)
bytedcli bytedog flamegraph create --pod <pod> --idc <IDC> --json

# I18N site
bytedcli --site i18n-tt bytedog flamegraph create --pod <pod> --idc <IDC> --json
```

## If authentication fails

You need to log in first:

```bash
# CN site
bytedcli auth login

# I18N site
bytedcli --site i18n-tt auth login
```

## TCE site to ByteCloud site mapping

| TCE Site | BYTEDCLI_CLOUD_SITE | Console Domain |
|----------|-------------------|----------------|
| prod | prod | bytedog.bytedance.net |
| i18n-tt | i18n-tt | bytedog-i18n.bytedance.net |
| ttp-us-limited | i18n-tt | bytedog-i18n.bytedance.net |
| ttp-eu | i18n-tt | bytedog-i18n.bytedance.net |
