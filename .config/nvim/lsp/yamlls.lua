--- @type vim.lsp.Config
local util = require("config.util")

return {
  cmd = { "yaml-language-server", "--stdio" },
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
