return {
  "folke/which-key.nvim",
  opts = {
    preset = "classic",
    keys = {
      scroll_down = "<c-j>",
      scroll_up = "<c-k>",
    },
    plugins = {
      spelling = {
        suggestions = 10,
      },
    },
    win = {
      no_overlap = false,
      height = { max = 23 },
      border = "rounded",
      padding = { 1, 1 },
    },
    layout = {
      width = { max = 100 },
      spacing = 1,
    },
    icons = {
      rules = {
        { pattern = "harpoon", icon = "󱓞 ", color = "orange" },
      },
    },
  },
  config = function(_, opts)
    local wk = require("which-key")
    wk.add({
      { "<leader>cU", group = "utils" },
      { "gc", group = "Toggle comment" },
    })
    wk.setup(opts)
  end,
}
