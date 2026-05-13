--- @type vim.lsp.Config
local ts_util = require("config.ts_util")
local util = require("config.util")

return {
  cmd = ts_util.bun_cmd(
    "json-lsp",
    "node_modules/vscode-langservers-extracted/bin/vscode-json-language-server",
    { "--stdio" }
  ),
  filetypes = { "json", "jsonc" },
  root_markers = { ".git" },
  init_options = {
    provideFormatter = true,
  },
  settings = {
    json = {
      schemas = util.schemastore("json"),
      validate = { enable = true },
    },
  },
}
