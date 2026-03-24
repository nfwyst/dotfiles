--- @type vim.lsp.Config
local schemas = {}
pcall(function()
  schemas = require("schemastore").json.schemas()
end)

return {
  cmd = { "taplo", "lsp", "stdio" },
  filetypes = { "toml" },
  root_markers = { ".taplo.toml", "taplo.toml", ".git" },
  settings = {
    toml = {
      schemas = schemas,
      validate = { enable = true },
    },
  },
}
