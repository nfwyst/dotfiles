local function init()
  AUTOCMD({
    "WinResized",
    "BufWinEnter",
    "CursorHold",
    "InsertLeave",
    "BufModifiedSet",
  }, {
    group = AUTOGROUP("barbecue.updater", {}),
    callback = function()
      pcall(function()
        require("barbecue.ui").update()
      end)
    end,
  })
end

local navic_enabled = not IS_WIN_LINUX

return {
  "utilyre/barbecue.nvim",
  name = "barbecue",
  cond = not IS_VSCODE,
  event = "VeryLazy",
  dependencies = {
    "SmiteshP/nvim-navic",
    "nvim-tree/nvim-web-devicons",
  },
  config = function()
    local color = GET_COLOR()
    local hl = { fg = color.bg_yellow, bold = true }
    require("barbecue").setup({
      create_autocmd = false,
      show_basename = false,
      exclude_filetypes = INVALID_FILETYPE,
      show_navic = navic_enabled,
      attach_navic = navic_enabled,
      modifiers = {
        dirname = ":~",
      },
      theme = {
        separator = hl,
        dirname = hl,
      },
    })
    init()
  end,
}
