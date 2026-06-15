--- @type vim.lsp.Config
local ts_util = require("config.ts_util")

return {
  cmd = ts_util.bun_cmd(
    "emmet-language-server",
    "node_modules/@olrtg/emmet-language-server/dist/index.js",
    { "--stdio" }
  ),
  filetypes = { "html", "css", "scss", "less", "javascriptreact", "typescriptreact", "svelte", "vue" },
  root_markers = { "package.json", ".git" },
}
