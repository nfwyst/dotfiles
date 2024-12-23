return {
  "folke/tokyonight.nvim",
  lazy = true,
  opts = function(_, opts)
    local opt = {
      light_style = "day",
      transparent = g.transparent_enabled,
      styles = {
        floats = "transparent",
        sidebars = "transparent",
      },
      lualine_bold = true,
      on_colors = function(colors)
        local fg = "#CBE0F0"
        local fg_dark = "#B4D0E9"
        colors.border = "#547998"
        colors.fg = fg
        colors.fg_dark = fg_dark
        colors.fg_float = fg
        colors.fg_sidebar = fg_dark
      end,
    }
    return merge("force", opts, opt)
  end,
}
