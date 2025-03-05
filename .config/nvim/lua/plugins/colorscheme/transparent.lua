defer(OVERWRITE_HLS, 0)

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
