if not (vim.uv or vim.loop).fs_stat(LAZY_PATH) then
  local lazyrepo = "https://github.com/folke/lazy.nvim.git"
  local out = vim.fn.system({
    "git",
    "clone",
    "--filter=blob:none",
    "--branch=stable",
    lazyrepo,
    LAZY_PATH,
  })
  if vim.v.shell_error ~= 0 then
    vim.api.nvim_echo({
      { "Failed to clone lazy.nvim:\n", "ErrorMsg" },
      { out, "WarningMsg" },
      { "\nPress any key to exit..." },
    }, true, {})
    vim.fn.getchar()
    os.exit(1)
  end
end
vim.opt.rtp:prepend(LAZY_PATH)

require("lazy").setup({
  spec = {
    { import = "plugins" },
    { import = "plugins.lsp" },
    { import = "plugins.dap" },
    { import = "plugins.colorscheme" },
    { import = "plugins.ui" },
    { import = "plugins.ai" },
    { import = "plugins.note" },
    { import = "plugins.style" },
    { import = "plugins.git" },
    { import = "plugins.navigation" },
  },
  install = {
    colorscheme = { "tokyonight", "NeoSolarized" },
  },
  ui = {
    border = "rounded",
  },
  checker = {
    enabled = false,
    notify = false,
  },
  change_detection = {
    notify = false,
  },
})
