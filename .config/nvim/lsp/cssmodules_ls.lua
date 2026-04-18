--- @type vim.lsp.Config
local ts_util = require("config.ts_util")

return {
  cmd = ts_util.bun_cmd(
    "cssmodules-language-server",
    "node_modules/cssmodules-language-server/lib/cli.js"
  ),
  filetypes = { "javascript", "javascriptreact", "typescript", "typescriptreact" },
  root_markers = { "package.json", ".git" },
}
