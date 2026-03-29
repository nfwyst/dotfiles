return {
  settings = {
    toml = {
      schemas = require("schemastore").json.schemas(),
      validate = { enable = true },
    },
  },
}
