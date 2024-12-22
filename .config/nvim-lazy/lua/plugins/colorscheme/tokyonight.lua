return {
  "folke/tokyonight.nvim",
  lazy = true,
  opts = function(_, opts)
    local opt = {
      light_style = "day",
      transparent = vim.g.transparent_enabled,
      styles = {
        floats = "transparent",
        sidebars = "transparent",
      },
      lualine_bold = true,
    }
    return merge("force", opts, opt)
  end,
}
