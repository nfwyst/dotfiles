return {
  "NickvanDyke/opencode.nvim",
  dependencies = { "folke/snacks.nvim" },
  keys = {
    { "<leader>a", "", desc = "ai", mode = { "n", "v" } },
    { "<leader>ao", "", desc = "opencode", mode = { "n", "v" } },
    {
      "<leader>aoa",
      function()
        require("opencode").ask("@this: ", { submit = true })
      end,
      desc = "Opencode: Ask About This",
      mode = { "n", "v" },
    },
    {
      "<leader>ao+",
      function()
        require("opencode").prompt("@this")
      end,
      desc = "Opencode: Add This",
      mode = { "n", "v" },
    },
    {
      "<leader>aop",
      function()
        require("opencode").select()
      end,
      desc = "Opencode: Select Prompt",
      mode = { "n", "v" },
    },
    {
      "<leader>aot",
      function()
        require("opencode").toggle()
      end,
      desc = "Opencode: Toggle Embedded",
    },
    {
      "<leader>aon",
      function()
        require("opencode").command("session_new")
      end,
      desc = "Opencode: New Session",
    },
    {
      "<leader>aoi",
      function()
        require("opencode").command("session_interrupt")
      end,
      desc = "Opencode: Interrupt Session",
    },
    {
      "<leader>aoA",
      function()
        require("opencode").command("agent_cycle")
      end,
      desc = "Opencode: Cycle Selected Agent",
    },
    {
      "<S-C-u>",
      function()
        require("opencode").command("messages_half_page_up")
      end,
      desc = "Opencode: Messages Half Page Up",
    },
    {
      "<S-C-d>",
      function()
        require("opencode").command("messages_half_page_down")
      end,
      desc = "Opencode: Messages Half Page Down",
    },
    {
      "<leader>aoI",
      function()
        require("opencode").command("project_init")
      end,
      desc = "Opencode: Init Project",
    },
    {
      "<leader>aoc",
      function()
        require("opencode").command("messages_copy")
      end,
      desc = "Opencode: Copy Last Response",
    },
  },
}
