local api = vim.api

local function set_conceal(win, level, cursor)
  api.nvim_set_option_value("conceallevel", level, { win = win })
  api.nvim_set_option_value("conecalcursor", cursor, { win = win })
end

return {
  "OXY2DEV/markview.nvim",
  cond = not IS_VSCODE_OR_LEET_CODE,
  lazy = false,
  dependencies = {
    "nvim-treesitter/nvim-treesitter",
    "nvim-tree/nvim-web-devicons",
  },
  config = function()
    require("markview").setup({
      modes = { "n", "i", "no", "c" },
      hybrid_modes = { "i" },
      callbacks = {
        on_enable = function(_, win)
          set_conceal(win, 2, "nc")
        end,
        on_disable = function(_, win)
          set_conceal(win, 0, "")
        end,
      },
      code_blocks = {
        style = "simple",
        pad_amount = 0,
      },
      list_items = {
        shift_width = 2,
      },
    })
  end,
}
