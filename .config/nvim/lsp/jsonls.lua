--- @type vim.lsp.Config
local schemas = {}
pcall(function()
  schemas = require("schemastore").json.schemas()
end)

return {
  cmd = { "vscode-json-language-server", "--stdio" },
  filetypes = { "json", "jsonc" },
  root_markers = { ".git" },
  init_options = {
    provideFormatter = true,
  },
  settings = {
    json = {
      schemas = schemas,
      validate = { enable = true },
    },
  },
}
