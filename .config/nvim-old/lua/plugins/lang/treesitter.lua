local language_map = {
  zsh = "bash",
  checkhealth = "markdown",
}
for from, to in pairs(language_map) do
  vim.treesitter.language.register(to, from)
end

return {
  "nvim-treesitter/nvim-treesitter",
  opts = {
    ensure_installed = { "all" },
    ignore_install = { "ipkg" },
  },
}
