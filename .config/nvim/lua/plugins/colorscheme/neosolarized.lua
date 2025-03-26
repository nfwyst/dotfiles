local is_italic_enabled = not IS_LINUX
local style = { italic = is_italic_enabled }

local function lsp_hl_getter(hl)
  hl.link = nil
  hl.bg = "#e7e7e7"

  return hl
end

local hls = {
  LspReferenceText = lsp_hl_getter,
  LspReferenceRead = lsp_hl_getter,
  LspReferenceWrite = lsp_hl_getter,
}

return {
  "Tsuzat/NeoSolarized.nvim",
  lazy = true,
  config = function()
    schedule(function()
      UPDATE_HLS(hls)
    end)

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
