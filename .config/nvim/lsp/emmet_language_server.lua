--- @type vim.lsp.Config
return {
  cmd = { "bun", "run", "--bun", "emmet-language-server", "--stdio" },
  filetypes = { "html", "css", "scss", "less", "javascriptreact", "typescriptreact", "svelte", "vue" },
  root_markers = { "package.json", ".git" },
}
