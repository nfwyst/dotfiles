return {
  on_new_config = function(new_config)
    local json = new_config.settings.json
    if not json.schemas then
      json.schemas = {}
    end

    push_list(json.schemas, require("schemastore").json.schemas())
  end,
  settings = {
    json = {
      format = { enable = true },
      validate = { enable = true },
    },
  },
}
