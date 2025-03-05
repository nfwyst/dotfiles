return {
  "Tsuzat/NeoSolarized.nvim",
  lazy = true,
  opts = {
    style = o.background,
    transparent = IS_INIT_BG_DARK,
    terminal_colors = true,
    enable_italics = true,
    styles = {
      functions = { bold = true },
      underline = true,
      undercurl = false,
    },
  },
}
