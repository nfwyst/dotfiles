local function set_conceal(win, level, cursor)
  SET_OPTS({ conceallevel = level, conecalcursor = cursor }, { win = win })
end

return {
  "nfwyst/markview.nvim",
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
      filetypes = { "markdown", "quarto", "rmd", "Avante" },
      buf_ignore = {},
      max_length = 99999,
    })
  end,
}
