-- Neovim 0.12+ Configuration
-- Migrated from LazyVim to native features
vim.loader.enable()

-- Leader keys (must be set before plugins)
vim.g.mapleader = " "
vim.g.maplocalleader = "\\"

-- Load configuration
require("config.options")
require("config.hack")
require("plugins")
require("config.lsp")
require("config.keymaps")
require("config.autocmds")
