local util = require("config.util")

local custom_highlights = {
  "NeoTreeMessage cterm=italic gui=italic guifg=#585b7b",
  "BufferLineBufferSelected cterm=italic gui=italic",
  "LspInlayHint cterm=italic gui=italic guibg=#0e1018",
  "CursorLine guibg=#3e4365",
  "TabLineFill guibg=none",
  "BlinkCmpGhostText guibg=#222539",
}

for _, config in ipairs(custom_highlights) do
  util.set_hl(config, true)
end

return {
  {
    "loctvl842/monokai-pro.nvim",
    lazy = true,
    opts = {
      transparent_background = true,
      filter = "classic",
    },
  },
  {
    "Tsuzat/NeoSolarized.nvim",
    lazy = true,
    opts = {
      transparent = true,
      terminal_colors = true,
      enable_italics = true,
    },
  },
  {
    "folke/tokyonight.nvim",
    opts = {
      transparent = true,
      lualine_bold = true,
      on_colors = function(c)
        c.bg_statusline = c.none
      end,
      styles = {
        sidebars = "transparent",
        floats = "transparent",
      },
    },
  },
}
