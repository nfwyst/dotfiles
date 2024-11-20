---@diagnostic disable-next-line: undefined-field
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

local disabled_plugins = {
  "rplugin",
  "shada",
  "spellfile",
  "gzip",
  "matchit",
  "matchparen",
  "netrwPlugin",
  "tarPlugin",
  "tutor",
  "zipPlugin",
  "tohtml",
  "osc52",
  "man",
}

if not IS_MAC then
  table.insert(disabled_plugins, "editorconfig")
end

lazy.setup({
  defaults = {
    version = nil,
  },
  rocks = {
    enabled = false,
  },
  git = {
    timeout = 300,
  },
  spec = {
    { import = "plugins" },
    { import = "plugins.lsp" },
    { import = "plugins.debug" },
    { import = "plugins.colorscheme" },
    { import = "plugins.autocomplete" },
    { import = "plugins.ui" },
    { import = "plugins.ai" },
    { import = "plugins.note" },
    { import = "plugins.style" },
    { import = "plugins.git" },
    { import = "plugins.navigation" },
  },
  install = { colorscheme = { "tokyonight", "NeoSolarized" } },
  ui = { border = "rounded", backdrop = 100, wrap = false },
  checker = { enabled = false, frequency = 86400, notify = false },
  change_detection = { notify = false },
  performance = {
    rtp = { disabled_plugins = disabled_plugins },
  },
})
