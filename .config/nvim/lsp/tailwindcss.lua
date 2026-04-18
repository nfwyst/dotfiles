--- @type vim.lsp.Config
local ts_util = require("config.ts_util")

local config_files = {
  "tailwind.config.js",
  "tailwind.config.ts",
  "tailwind.config.cjs",
  "tailwind.config.mjs",
}

return {
  cmd = ts_util.bun_cmd(
    "tailwindcss-language-server",
    "node_modules/@tailwindcss/language-server/bin/tailwindcss-language-server",
    { "--stdio" }
  ),
  filetypes = { "html", "css", "scss", "javascript", "javascriptreact", "typescript", "typescriptreact", "svelte", "vue" },
  root_markers = config_files,
  on_attach = function(client, bufnr)
    local config_root = vim.fs.root(bufnr, config_files)
    if not config_root then
      client:stop()
    end
  end,
}
