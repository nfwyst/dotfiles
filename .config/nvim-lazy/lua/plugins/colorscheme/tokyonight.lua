return {
  "folke/tokyonight.nvim",
  lazy = true,
  opts = function(_, opts)
    local opt = {
      light_style = "day",
      transparent = true,
      styles = {
        floats = "transparent",
        sidebars = "transparent",
      },
      lualine_bold = true,
    }
    return merge("force", opts, opt)
  end,
}
