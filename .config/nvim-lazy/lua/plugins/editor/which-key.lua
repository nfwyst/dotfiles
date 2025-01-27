return {
  "folke/which-key.nvim",
  opts = {
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
      height = { max = 38 },
    },
    icons = {
      rules = {
        { pattern = "harpoon", icon = "󱓞 ", color = "orange" },
      },
    },
  },
}
