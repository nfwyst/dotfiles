local name = "NeoSolarized"
local illuminate = { bg = "#B2D4FC", fg = "#4d2b03", bold = true }

local function init_hi()
  local colors = require("NeoSolarized.colors")
  local color = colors[SCHEME_BACKGROUND]
  SET_TIMEOUT(function()
    SET_HL(MERGE_TABLE(CURSOR_HILIGHT_OPTS, {
      CursorLineNr = { fg = "#388bfd" },
      ["@variable"] = { fg = color.fg0 },
      Normal = { fg = color.fg0 },
      Comment = { fg = color.fg2 },
      LineNrAbove = { fg = color.fg1 },
      LineNr = { fg = color.fg1 },
      LineNrBelow = { fg = color.fg1 },
      IlluminatedWord = illuminate,
      IlluminatedCurWord = illuminate,
      IlluminatedWordText = illuminate,
      IlluminatedWordRead = illuminate,
      IlluminatedWordWrite = illuminate,
    }))
  end)
end

return {
  "Tsuzat/NeoSolarized.nvim",
  name = name,
  lazy = false,
  priority = 1000,
  config = function()
    require(name).setup({
      style = SCHEME_BACKGROUND,
      transparent = true,
      terminal_colors = true,
      enable_italics = true,
      styles = {
        keywords = { italic = false },
        functions = { bold = true },
        string = { italic = false },
        underline = true,
        undercurl = false,
      },
    })
    SET_COLORSCHEME(name)
    init_hi()
  end,
}
