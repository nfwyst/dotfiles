local function get_style()
  if g.transparent_enabled then
    return "transparent"
  end

  if o.background == "dark" then
    return "dark"
  end

  return "normal"
end

return {
  "folke/tokyonight.nvim",
  lazy = true,
  opts = function(_, opts)
    local style = get_style()
    local opt = {
      light_style = "day",
      transparent = g.transparent_enabled,
      styles = {
        floats = style,
        sidebars = style,
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

    return merge(opts, opt)
  end,
}
