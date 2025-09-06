return {
  "kawre/leetcode.nvim",
  cmd = "Leet",
  keys = {
    { "<leader>cUl", "", desc = "leet code" },
    { "<leader>cUlm", "<cmd>Leet<cr>", desc = "Leet Code: Menu" },
    { "<leader>cUla", "<cmd>Leet random<cr>", desc = "Leet Code: Random" },
    { "<leader>cUlc", "<cmd>Leet console<cr>", desc = "Leet Code: Console" },
    { "<leader>cUld", "<cmd>Leet desc<cr>", desc = "Leet Code: Description" },
    { "<leader>cUlh", "<cmd>Leet hints<cr>", desc = "Leet Code: Hints" },
    { "<leader>cUli", "<cmd>Leet info<cr>", desc = "Leet Code: Info" },
    { "<leader>cUll", "<cmd>Leet lang<cr>", desc = "Leet Code: Language" },
    { "<leader>cUlq", "<cmd>Leet tabs<cr>", desc = "Leet Code: Tabs" },
    { "<leader>cUlr", "<cmd>Leet run<cr>", desc = "Leet Code: Run" },
    { "<leader>cUls", "<cmd>Leet submit<cr>", desc = "Leet Code: Submit" },
    { "<leader>cUlt", "<cmd>Leet list<cr>", desc = "Leet Code: List" },
    { "<leader>cUly", "<cmd>Leet daily<cr>", desc = "Leet Code: Daily" },
  },
  dependencies = {
    "MunifTanjim/nui.nvim",
  },
  opts = {
    lang = "typescript",
    logging = false,
    picker = "snacks-picker",
    cn = {
      enabled = true,
    },
  },
}
