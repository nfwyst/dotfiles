local function report_error(output)
  local messages = {
    { "Failed to clone lazy.nvim:\n", "ErrorMsg" },
    { output, "WarningMsg" },
    { "\nPress any key to exit..." },
  }
  api.nvim_echo(messages, true, {})
  fn.getchar()
end

local function install_pkg_manager()
  local lazypath = DATA_PATH .. "/lazy/lazy.nvim"
  local is_dir = IS_DIRPATH(lazypath)
  local opt = vim.opt

  if is_dir then
    opt.rtp:prepend(lazypath)
    return true
  end

  local lazyrepo = "https://github.com/folke/lazy.nvim.git"
  local command = { "git", "clone", "--filter=blob:none", "--branch=stable", lazyrepo, lazypath }
  local output = fn.system(command)
  local err = v.shell_error ~= 0

  if not err then
    opt.rtp:prepend(lazypath)
    return true
  end

  report_error(output)

  return false
end

local installed = install_pkg_manager()

if not installed then
  return os.exit(1)
end

local ok = pcall(require, "lazy")
if not ok then
  report_error("lazy not found, please check installation directory")
  return os.exit(1)
end

local function get_disabled_plugins()
  return {
    "rplugin",
    "shada",
    "gzip",
    "netrwPlugin",
    "tarPlugin",
    "tutor",
    "zipPlugin",
    "tohtml",
    "spellfile",
    "osc52",
  }
end

require("lazy").setup({
  install = { colorscheme = { "tokyonight", "NeoSolarized" } },
  spec = {
    {
      "LazyVim/LazyVim",
      import = "lazyvim.plugins",
      opts = { colorscheme = o.background == "dark" and "molokai" or "NeoSolarized" },
    },
    { import = "plugins" },
    { import = "plugins.colorscheme" },
    { import = "plugins.lsp" },
    { import = "plugins.editor" },
    { import = "plugins.ui" },
    { import = "plugins.ai" },
    { import = "plugins.lang" },
    { import = "plugins.treesitter" },
    { import = "plugins.util" },
    { import = "plugins.coding" },
  },
  defaults = {
    version = false,
  },
  rocks = {
    enabled = false,
    hererocks = false,
  },
  git = {
    timeout = 1000,
  },
  ui = { border = "rounded", backdrop = 100, wrap = true },
  checker = {
    enabled = not PERFORMANCE_MODE,
    notify = false,
  },
  change_detection = { notify = false },
  performance = {
    rtp = {
      disabled_plugins = get_disabled_plugins(),
    },
  },
})
