local util = require("config.util")

return {
  {
    "loctvl842/monokai-pro.nvim",
    opts = {
      transparent_background = true,
      filter = "classic",
    },
  },
  {
    "Tsuzat/NeoSolarized.nvim",
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
      on_highlights = function(hl, c)
        hl.TabLineFill = {
          bg = c.none,
        }

        util.set_hl("NeoTreeMessage guifg=#585b7b", true)
        util.set_hl("LspInlayHint guibg=#0e1018", true)
      end,
      styles = {
        sidebars = "transparent",
        floats = "transparent",
      },
    },
  },
}
