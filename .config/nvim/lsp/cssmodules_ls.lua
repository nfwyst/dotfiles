--- @type vim.lsp.Config
return {
  cmd = { "bun", "run", "--bun", "cssmodules-language-server" },
  filetypes = { "javascript", "javascriptreact", "typescript", "typescriptreact" },
  root_markers = { "package.json", ".git" },
}
