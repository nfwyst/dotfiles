-- Colorscheme configuration
local util = require("config.util")

-- Tokyonight setup
require("tokyonight").setup({
  transparent = true,
  lualine_bold = true,
  on_colors = function(c)
    c.bg_statusline = c.none
  end,
  styles = {
    sidebars = "transparent",
    floats = "transparent",
  },
})

-- Monokai-pro (lazy loaded)
pcall(function()
  require("monokai-pro").setup({
    transparent_background = true,
    filter = "classic",
  })
end)

-- NeoSolarized (lazy loaded)
pcall(function()
  require("NeoSolarized").setup({
    transparent = true,
    terminal_colors = true,
    enable_italics = true,
  })
end)

-- Set colorscheme
vim.cmd.colorscheme("tokyonight")

-- Custom highlights
local custom_highlights = {
  "BufferLineBufferSelected cterm=italic gui=italic",
  "LspInlayHint cterm=italic gui=italic guibg=#0e1018",
  "CursorLine guibg=#3e4365",
  "TabLineFill guibg=none",
  "BlinkCmpGhostText guibg=#222539",
  "SnacksPickerInputBorder guifg=#3e4365",
  "SnacksPickerInputTitle guifg=#589ed7",
}

for _, config in ipairs(custom_highlights) do
  util.set_hl(config, true)
end
