local enable_italics = not IS_LINUX

return {
  "Tsuzat/NeoSolarized.nvim",
  lazy = true,
  config = function()
    if IS_SYNTAX_OFF then
      UPDATE_HLS({
        Function = { link = "Normal" },
      })
    end

    require("NeoSolarized").setup({
      style = o.background,
      transparent = IS_INIT_BG_DARK,
      terminal_colors = true,
      enable_italics = enable_italics,
      styles = {
        functions = { bold = true },
        comments = { italic = enable_italics },
        keywords = { italic = enable_italics },
        string = { italic = enable_italics },
        underline = true,
        undercurl = false,
      },
    })
  end,
}
