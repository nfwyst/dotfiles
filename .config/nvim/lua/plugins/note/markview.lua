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
      modes = { "n", "no", "c" },
      hybrid_modes = { "n" }, -- uses this feature on normal mode
      callbacks = {
        on_enable = function(_, win)
          vim.wo[win].conceallevel = 2
          vim.wo[win].conecalcursor = "c"
        end,
      },
    })
  end,
}
