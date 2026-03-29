--- @type vim.lsp.Config
local schemas = {}
pcall(function()
  schemas = require("schemastore").yaml.schemas()
end)

return {
  cmd = { "yaml-language-server", "--stdio" },
  filetypes = { "yaml", "yaml.docker-compose" },
  root_markers = { ".git" },
  settings = {
    yaml = {
      schemaStore = {
        -- Disable built-in schemaStore to use SchemaStore.nvim
        enable = false,
        url = "",
      },
      schemas = schemas,
      validate = true,
      keyOrdering = false,
    },
    redhat = { telemetry = { enabled = false } },
  },
}
