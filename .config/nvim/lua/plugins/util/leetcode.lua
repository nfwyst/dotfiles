return {
  "kawre/leetcode.nvim",
  cmd = "Leet",
  keys = {
    { "<leader>cul", "", desc = "Leet Code" },
    { "<leader>culm", "<cmd>Leet<cr>", desc = "Leet Code: Menu" },
    { "<leader>cula", "<cmd>Leet random<cr>", desc = "Leet Code: Random" },
    { "<leader>culc", "<cmd>Leet console<cr>", desc = "Leet Code: Console" },
    { "<leader>culd", "<cmd>Leet desc<cr>", desc = "Leet Code: Description" },
    { "<leader>culh", "<cmd>Leet hints<cr>", desc = "Leet Code: Hints" },
    { "<leader>culi", "<cmd>Leet info<cr>", desc = "Leet Code: Info" },
    { "<leader>cull", "<cmd>Leet lang<cr>", desc = "Leet Code: Language" },
    { "<leader>culq", "<cmd>Leet tabs<cr>", desc = "Leet Code: Tabs" },
    { "<leader>culr", "<cmd>Leet run<cr>", desc = "Leet Code: Run" },
    { "<leader>culs", "<cmd>Leet submit<cr>", desc = "Leet Code: Submit" },
    { "<leader>cult", "<cmd>Leet list<cr>", desc = "Leet Code: List" },
    { "<leader>culy", "<cmd>Leet daily<cr>", desc = "Leet Code: Daily" },
  },
  dependencies = {
    "ibhagwan/fzf-lua",
    "MunifTanjim/nui.nvim",
  },
  opts = {
    lang = "typescript",
    logging = false,
    cn = {
      enabled = true,
    },
  },
}
