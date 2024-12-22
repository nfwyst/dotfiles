return {
  on_new_config = function(new_config)
    local schemas = new_config.settings.json.schemas
    if not schemas then
      schemas = {}
      new_config.settings.json.schemas = schemas
    end

    push(schemas, require("schemastore").json.schemas())
  end,
  settings = {
    json = {
      format = { enable = true },
      validate = { enable = true },
    },
  },
}
