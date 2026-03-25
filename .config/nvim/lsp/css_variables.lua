--- @type vim.lsp.Config
return {
  cmd = { "css-variables-language-server", "--stdio" },
  filetypes = { "css", "scss" },
  root_markers = { "package.json", ".git" },
}
