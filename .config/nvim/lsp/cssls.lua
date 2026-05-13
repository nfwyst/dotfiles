--- @type vim.lsp.Config
local ts_util = require("config.ts_util")

return {
  cmd = ts_util.bun_cmd(
    "css-lsp",
    "node_modules/vscode-langservers-extracted/bin/vscode-css-language-server",
    { "--stdio" }
  ),
  filetypes = { "css", "scss", "less" },
  root_markers = { "package.json", ".git" },
}
