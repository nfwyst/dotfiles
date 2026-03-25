-- Colorscheme configuration
local util = require("config.util")

-- Tokyonight setup
require("tokyonight").setup({
  style = "day",
  light_style = "day",
  transparent = false,
  lualine_bold = true,
  on_colors = function(c)
    c.bg_statusline = c.none
  end,
  styles = {
    sidebars = "normal",
    floats = "normal",
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
vim.cmd.colorscheme("tokyonight-day")

-- Custom highlights (adapted for light theme)
local custom_highlights = {
  "BufferLineBufferSelected cterm=italic gui=italic",
  "LspInlayHint cterm=italic gui=italic",
  "TabLineFill guibg=none",
  "SnacksPickerInputTitle guifg=#2e7de9",
}

for _, config in ipairs(custom_highlights) do
  util.set_hl(config, true)
end
