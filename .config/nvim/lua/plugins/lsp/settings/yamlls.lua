return {
  capabilities = {
    textDocument = {
      foldingRange = {
        dynamicRegistration = false,
        lineFoldingOnly = true,
      },
    },
  },
  on_new_config = function(new_config)
    local json = new_config.settings.json
    if not json.schemas then
      json.schemas = {}
    end

    json.schemas = merge(json.schemas, require("schemastore").yaml.schemas())
  end,
  settings = {
    redhat = { telemetry = { enabled = false } },
    yaml = {
      keyOrdering = false,
      format = {
        enable = true,
      },
      validate = true,
      schemaStore = {
        enable = false,
        url = "",
      },
    },
  },
}
