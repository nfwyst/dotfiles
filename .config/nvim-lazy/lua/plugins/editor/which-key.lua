return {
  "folke/which-key.nvim",
  opts = {
    plugins = {
      spelling = {
        suggestions = 10,
      },
    },
    win = {
      height = { max = 85 },
    },
    icons = {
      rules = {
        { pattern = "harpoon", icon = "󱓞 ", color = "orange" },
      },
    },
  },
}
