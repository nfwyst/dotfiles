return {
  "nvimdev/lspsaga.nvim",
  event = "LspAttach",
  keys = {
    { "<leader>cL", "", desc = "lsp saga" },
    { "<leader>cLi", "<cmd>Lspsaga incoming_calls<cr>", desc = "Lspsaga: Incoming Calls" },
    { "<leader>cLo", "<cmd>Lspsaga outgoing_calls<cr>", desc = "Lspsaga: Outgoing Calls" },
    { "<leader>cLt", "<cmd>Lspsaga subtypes<cr>", desc = "Lspsaga: Subtypes" },
    { "<leader>cLT", "<cmd>Lspsaga supertypes<cr>", desc = "Lspsaga: SuperTypes" },
  },
  opts = {
    implement = {
      enable = false,
    },
    symbol_in_winbar = {
      enable = false,
    },
    lightbulb = {
      enable = false,
    },
    beacon = {
      enable = false,
    },
  },
}
