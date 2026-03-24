--- @type vim.lsp.Config
local config_files = {
  "tailwind.config.js",
  "tailwind.config.ts",
  "tailwind.config.cjs",
  "tailwind.config.mjs",
}

return {
  cmd = { "bun", "run", "--bun", "tailwindcss-language-server", "--stdio" },
  filetypes = { "html", "css", "scss", "javascript", "javascriptreact", "typescript", "typescriptreact", "svelte", "vue" },
  root_markers = config_files,
  on_attach = function(client, bufnr)
    local config_root = vim.fs.root(bufnr, config_files)
    if not config_root then
      client:stop()
    end
  end,
}
