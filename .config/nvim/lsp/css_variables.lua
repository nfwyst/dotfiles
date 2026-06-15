--- @type vim.lsp.Config
local ts_util = require("config.ts_util")

return {
  cmd = ts_util.bun_cmd(
    "css-variables-language-server",
    "node_modules/css-variables-language-server/bin/index.js",
    { "--stdio" }
  ),
  filetypes = { "css", "scss" },
  root_markers = { "package.json", ".git" },
}
