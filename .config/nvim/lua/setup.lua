if not vim.uv.fs_stat(LAZY_PATH) then
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

local ok, lazy = pcall(require, "lazy")
if not ok then
  return
end

lazy.setup({
  defaults = {
    version = false,
  },
  rocks = {
    enabled = false,
  },
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
  install = { colorscheme = { "tokyonight", "NeoSolarized" } },
  ui = { border = "rounded", backdrop = 100, wrap = false },
  checker = { enabled = true, frequency = 3600 * 24, notify = false },
  change_detection = { notify = false },
})
