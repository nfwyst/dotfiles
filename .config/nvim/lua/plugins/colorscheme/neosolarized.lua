local italic = not IS_LINUX
local style = { italic = italic }

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

local link = { link = "Normal" }
if IS_SYNTAX_OFF then
  assign(hls, {
    Function = link,
    Identifier = link,
    Keyword = link,
  })
end

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
      enable_italics = italic,
      styles = {
        functions = { bold = true, italic = italic },
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
