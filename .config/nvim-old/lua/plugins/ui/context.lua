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
    zindex = 25,
  },
}
