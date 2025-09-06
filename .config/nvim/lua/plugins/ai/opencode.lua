return {
  "NickvanDyke/opencode.nvim",
  dependencies = { "folke/snacks.nvim" },
  keys = {
    { "<leader>a", "", desc = "ai", mode = { "n", "v" } },
    { "<leader>ao", "", desc = "OpenCode", mode = { "n", "v" } },
    {
      "<leader>aoa",
      function()
        require("opencode").ask()
      end,
      desc = "Ask Opencode",
      mode = "n",
    },
    {
      "<leader>aoa",
      function()
        require("opencode").ask("@selection: ")
      end,
      desc = "Ask Opencode About Selection",
      mode = "v",
    },
    {
      "<leader>aop",
      function()
        require("opencode").select_prompt()
      end,
      desc = "Select Prompt",
      mode = { "n", "v" },
    },
    {
      "<leader>aot",
      function()
        require("opencode").toggle()
      end,
      desc = "Toggle Opencode",
      mode = "n",
    },
    {
      "<leader>aoc",
      function()
        require("opencode").command("messages_copy")
      end,
      desc = "Copy Last Opencode Response",
      mode = "n",
    },
  },
  config = function()
    vim.g.opencode_opts = {
      auto_fallback_to_embedded = false,
    }
  end,
}
