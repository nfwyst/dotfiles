--- @type vim.lsp.Config
local ts_util = require("config.ts_util")
local util = require("config.util")

return {
  cmd = ts_util.bun_cmd(
    "yaml-language-server",
    "node_modules/yaml-language-server/bin/yaml-language-server",
    { "--stdio" }
  ),
  filetypes = { "yaml", "yaml.docker-compose" },
  root_markers = { ".git" },
  settings = {
    yaml = {
      schemaStore = {
        enable = false,
        url = "",
      },
      schemas = util.schemastore("yaml"),
      validate = true,
      keyOrdering = false,
    },
    redhat = { telemetry = { enabled = false } },
  },
}
