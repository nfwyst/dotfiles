return {
  "Zeioth/markmap.nvim",
  build = "bun add -g markmap-cli",
  cmd = { "MarkmapOpen", "MarkmapSave", "MarkmapWatch", "MarkmapWatchStop" },
  keys = {
    { "<leader>cUm", "", desc = "markmap" },
    { "<leader>cUmo", "<cmd>MarkmapOpen<cr>", desc = "MarkMap: Open" },
    { "<leader>cUms", "<cmd>MarkmapSave<cr>", desc = "MarkMap: Save" },
    { "<leader>cUmw", "<cmd>MarkmapWatch<cr>", desc = "MarkMap: Watch" },
    { "<leader>cUmW", "<cmd>MarkmapWatchStop<cr>", desc = "MarkMap: Stop Watch" },
  },
  opts = {
    html_output = "/tmp/markmap.html",
    hide_toolbar = false,
    grace_period = 3600000, -- Stops markmap watch after 60 minutes, Set to 0 to disable.
  },
}
