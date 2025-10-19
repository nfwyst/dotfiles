-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here
local g_opts = {
  lazyvim_blink_main = true,
  snacks_animate = true,
  ai_cmp = false,
  editorconfig = true,
  transparent_enabled = true,
  autoformat = true,
  todopath = vim.fn.stdpath("data") .. "/snacks/todo/todo.md",
  loaded_perl_provider = 0,
  loaded_ruby_provider = 0,
  python3_host_prog = "/opt/homebrew/bin/python3",
}

for name, value in pairs(g_opts) do
  vim.g[name] = value
end

local scrolloff = math.floor(vim.api.nvim_win_get_height(vim.api.nvim_get_current_win()) / 2)
local opts = {
  softtabstop = 2,
  numberwidth = 2,
  spelllang = "en,cjk",
  listchars = "tab:▓░,trail:•,extends:»,precedes:«,nbsp:░",
  showcmd = false,
  modeline = false,
  swapfile = false,
  scrolloff = scrolloff > 1 and scrolloff - 1 or scrolloff,
}

for name, value in pairs(opts) do
  vim.o[name] = value
end
