return {
  "nvim-treesitter/nvim-treesitter-context",
  keys = {
    {
      "gC",
      function()
        require("treesitter-context").go_to_context()
      end,
      desc = "Goto Super Scope",
    },
  },
  opts = {
    max_lines = IS_LINUX and 3 or 6,
    zindex = 30,
    min_window_height = 10,
    on_attach = function(bufnr)
      return not IS_BIG_FILE(bufnr)
    end,
  },
}
