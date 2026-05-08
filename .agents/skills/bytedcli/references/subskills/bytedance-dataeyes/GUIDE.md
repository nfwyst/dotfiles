---
name: bytedance-dataeyes
description: "Dataeyes data validation testing capabilities via bytedcli. Invoke when tasks mention Dataeyes validation, task validation, data test, project configuration, or validation report retrieval."
---

# bytedance-dataeyes

Dataeyes data validation testing capabilities. Refer to the [Dataeyes documentation](https://cloud.tiktok-row.net/docs/product/dataeyes?from=cloud&cdc_fallback=1&region=Singapore-Central&x-bc-region-id=bytedance) for details.

## Commands

### Project Management

*   `bytedcli dataeyes project list`: List Dataeyes projects.
*   `bytedcli dataeyes project get`: Get basic or detailed info about a project.
*   `bytedcli dataeyes project create`: Create a new Dataeyes project.
*   `bytedcli dataeyes project update-config`: Update a Dataeyes project (supports any API-accepted fields, including QPS shortcuts).
*   `bytedcli dataeyes project update-validation-config`: Update validationConfig for a project.

### Validation & Tasks

*   `bytedcli dataeyes validation start`: Start a validation task for a project.
*   `bytedcli dataeyes validation list`: List validation tasks associated with a project.
*   `bytedcli dataeyes validation get-report`: Get the validation report of a completed task.
*   `bytedcli dataeyes task create`: Create tasks (use --validation for small-traffic validation, --fix/--simulate-fix for formal tasks).
*   `bytedcli dataeyes task get`: Get detailed info of a task.
*   `bytedcli dataeyes task pause`: Pause a running task.
*   `bytedcli dataeyes task continue`: Continue a paused task.
*   `bytedcli dataeyes task kill`: Kill a running task.

## References

- [dataeyes.md](./references/dataeyes.md)
- [invocation.md](./references/invocation.md)
- [troubleshooting.md](./references/troubleshooting.md)
