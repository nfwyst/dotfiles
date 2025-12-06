local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not (vim.uv or vim.loop).fs_stat(lazypath) then
  local lazyrepo = "https://github.com/folke/lazy.nvim.git"
  local out = vim.fn.system({ "git", "clone", "--filter=blob:none", "--branch=stable", lazyrepo, lazypath })
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
vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
  spec = {
    { "LazyVim/LazyVim", import = "lazyvim.plugins", opts = { colorscheme = "tokyonight" } },
    { import = "plugins" },
    { import = "plugins.ai" },
    { import = "plugins.coding" },
    { import = "plugins.editor" },
    { import = "plugins.lang" },
    { import = "plugins.lsp" },
    { import = "plugins.ui" },
    { import = "plugins.util" },
  },
  defaults = {
    lazy = false,
    version = false,
  },
  rocks = {
    enabled = false,
    hererocks = false,
  },
  install = { colorscheme = { "tokyonight", "habamax" } },
  checker = {
    enabled = true,
    notify = false,
  },
  git = {
    timeout = 1000,
  },
  ui = { border = "rounded", backdrop = 100, wrap = true },
  change_detection = { notify = false },
  performance = {
    rtp = {
      disabled_plugins = {
        "gzip",
        "netrwPlugin",
        "rplugin",
        "tarPlugin",
        "tohtml",
        "tutor",
        "zipPlugin",
      },
    },
  },
})
