return {
  "xiyaowong/transparent.nvim",
  lazy = false,
  priority = 1000,
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
        "WinBar1",
        "WinBar2",
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
      },
      on_clear = function()
        defer(function()
          SET_HLS({
            WinBar1 = { fg = "#04d1f9", bg = "#1E2030" },
            WinBar2 = { fg = "#37f499", bg = "#1E2030" },
            CursorLineNr = { fg = "#388bfd" },
            MatchParen = { bg = "#000000" },
            Cursor = { bg = "#5f87af", ctermbg = 67, blend = 0 },
            iCursor = { bg = "#ffffaf", ctermbg = 229 },
            rCursor = { bg = "#d70000", ctermbg = 124 },
          })
        end, 30)
      end,
    })
  end,
}
