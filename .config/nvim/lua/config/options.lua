-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here
vim.g.lazyvim_blink_main = true
vim.g.snacks_animate = true
vim.g.ai_cmp = false
vim.g.editorconfig = true
vim.g.transparent_enabled = true
vim.g.autoformat = true

local opts = {
  softtabstop = 2,
  numberwidth = 2,
  spelllang = "en,cjk",
  listchars = "tab:▓░,trail:•,extends:»,precedes:«,nbsp:░",
  showcmd = false,
  modeline = false,
  swapfile = false,
}

for name, value in pairs(opts) do
  vim.o[name] = value
end
