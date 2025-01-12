local function set_custom_highlight()
  local fg1 = "#657b83"
  local fg0 = "#839496"
  local fg2 = "#586e75"
  SET_HLS({
    CursorLine = { bg = fg1 },
    ["@variable"] = { fg = fg0 },
    Normal = { fg = fg0 },
    Comment = { fg = fg2 },
    LineNrAbove = { fg = fg1 },
    LineNr = { fg = fg1 },
    LineNrBelow = { fg = fg1 },
    CursorLineNr = { fg = "#388bfd" },
    MatchParen = { bg = "#000000" },
    Cursor = { bg = "#5f87af", ctermbg = 67, blend = 0 },
    iCursor = { bg = "#ffffaf", ctermbg = 229 },
    rCursor = { bg = "#d70000", ctermbg = 124 },
  })
end

defer(set_custom_highlight, 0)

return {
  "xiyaowong/transparent.nvim",
  cond = not IS_LINUX,
  config = function()
    require("transparent").setup({
      groups = {
        "Normal",
        "NormalNC",
        "Constant",
        "Special",
        "Identifier",
        "Statement",
        "PreProc",
        "Type",
        "Underlined",
        "Todo",
        "String",
        "Function",
        "Conditional",
        "Repeat",
        "Operator",
        "Structure",
        "NonText",
        "SignColumn",
        "StatusLine",
        "StatusLineNC",
        "EndOfBuffer",
        "FloatBorder",
      },
      extra_groups = {
        "NormalFloat",
        "FzfLuaFzfCursorLine",
      },
      exclude_groups = {
        "Cursor",
        "CursorLine",
        "CursorLineNr",
        "Comment",
        "LineNrAbove",
        "LineNr",
        "LineNrBelow",
        "MatchParen",
        "iCursor",
        "rCursor",
      },
    })
  end,
}
