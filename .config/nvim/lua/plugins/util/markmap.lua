return {
  "Zeioth/markmap.nvim",
  build = "bun add -g markmap-cli",
  cmd = { "MarkmapOpen", "MarkmapSave", "MarkmapWatch", "MarkmapWatchStop" },
  keys = {
    { "<leader>cum", "", desc = "markmap" },
    { "<leader>cumo", "<cmd>MarkmapOpen<cr>", desc = "MarkMap: Open" },
    { "<leader>cums", "<cmd>MarkmapSave<cr>", desc = "MarkMap: Save" },
    { "<leader>cumw", "<cmd>MarkmapWatch<cr>", desc = "MarkMap: Watch" },
    { "<leader>cumW", "<cmd>MarkmapWatchStop<cr>", desc = "MarkMap: Stop Watch" },
  },
  opts = function(_, opts)
    local opt = {
      html_output = "/tmp/markmap.html",
      hide_toolbar = false,
      grace_period = 3600000, -- Stops markmap watch after 60 minutes, Set to 0 to disable.
    }

    return merge(opts, opt)
  end,
}
