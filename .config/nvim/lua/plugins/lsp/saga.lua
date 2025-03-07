return {
  "nvimdev/lspsaga.nvim",
  event = "LspAttach",
  keys = {
    { "<leader>cL", "", desc = "lsp saga" },
    { "<leader>cLi", "<cmd>Lspsaga incoming_calls<cr>", desc = "Lspsaga: Incoming Calls" },
    { "<leader>cLo", "<cmd>Lspsaga outgoing_calls<cr>", desc = "Lspsaga: Outgoing Calls" },
  },
  opts = {
    implement = {
      enable = false,
    },
    symbol_in_winbar = {
      enable = false,
    },
    lightbulb = {
      enable = not IS_LINUX,
    },
    beacon = {
      enable = not IS_LINUX,
    },
  },
}
