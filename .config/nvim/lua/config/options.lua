-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here
vim.g.lazyvim_blink_main = true
vim.g.snacks_animate = true
vim.g.ai_cmp = false
vim.g.editorconfig = true
vim.g.transparent_enabled = true
vim.g.autoformat = true
vim.g.todopath = vim.fn.stdpath("data") .. "/snacks/todo/todo.md"
vim.g.loaded_perl_provider = true
vim.g.loaded_ruby_provider = true

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
