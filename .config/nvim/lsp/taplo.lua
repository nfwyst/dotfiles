--- @type vim.lsp.Config
local util = require("config.util")

return {
  cmd = { "taplo", "lsp", "stdio" },
  filetypes = { "toml" },
  root_markers = { ".taplo.toml", "taplo.toml", ".git" },
  settings = {
    toml = {
      schemas = util.schemastore("json"),
      validate = { enable = true },
    },
  },
}
