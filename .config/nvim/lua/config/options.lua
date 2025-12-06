-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here
local g_opts = {
  lazyvim_blink_main = true,
  snacks_animate = true,
  ai_cmp = true,
  editorconfig = true,
  transparent_enabled = true,
  autoformat = true,
  todopath = vim.fn.stdpath("data") .. "/snacks/todo/todo.md",
  loaded_perl_provider = 0,
  loaded_ruby_provider = 0,
  python3_host_prog = "/opt/homebrew/bin/python3",
  markdowns = { "markdown", "Avante", "codecompanion", "octo", "grug-far-help", "checkhealth" },
}

for name, value in pairs(g_opts) do
  vim.g[name] = value
end

-- calculate scrolloff size
local scrolloff = math.floor(vim.api.nvim_win_get_height(vim.api.nvim_get_current_win()) / 4)
if scrolloff > 1 then
  scrolloff = scrolloff - 1
end
if scrolloff < 4 then
  scrolloff = 4
end

local opts = {
  softtabstop = 2,
  numberwidth = 2,
  spelllang = "en,cjk",
  listchars = "tab:▓░,trail:•,extends:»,precedes:«,nbsp:░",
  showcmd = false,
  modeline = false,
  swapfile = false,
  scrolloff = scrolloff,
}

for name, value in pairs(opts) do
  vim.o[name] = value
end

-- make filetype pattern
vim.filetype.add({
  pattern = {
    ["compose.*%.ya?ml"] = "yaml.docker-compose",
    ["docker%-compose.*%.ya?ml"] = "yaml.docker-compose",
  },
})
