--- @type vim.lsp.Config
local ts_util = require("config.ts_util")

return {
  cmd = ts_util.bun_cmd(
    "html-lsp",
    "node_modules/vscode-langservers-extracted/bin/vscode-html-language-server",
    { "--stdio" }
  ),
  filetypes = { "html", "templ" },
  root_markers = { "package.json", ".git" },
}
