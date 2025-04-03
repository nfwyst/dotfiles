local is_italic_enabled = not IS_LINUX
local style = { italic = is_italic_enabled }

return {
  "Tsuzat/NeoSolarized.nvim",
  lazy = true,
  config = function()
    require("NeoSolarized").setup({
      style = o.background,
      transparent = g.transparent_enabled and o.background == "dark",
      terminal_colors = true,
      enable_italics = is_italic_enabled,
      styles = {
        functions = { bold = true, italic = is_italic_enabled },
        comments = style,
        keywords = style,
        string = style,
        variables = style,
        underline = true,
        undercurl = false,
      },
    })
  end,
}
