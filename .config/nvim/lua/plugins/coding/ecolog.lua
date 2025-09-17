return {
  "ph1losof/ecolog.nvim",
  branch = "beta",
  keys = {
    { "<leader>cEg", "<cmd>EcologGoto<cr>", desc = "Go To Env File" },
    { "<leader>cEp", "<cmd>EcologPeek<cr>", desc = "Ecolog Peek Variable" },
    { "<leader>cEs", "<cmd>EcologSelect<cr>", desc = "Switch Env File" },
  },
  lazy = false,
  opts = {
    integrations = {
      blink_cmp = true,
    },
    shelter = {
      modules = {
        snacks_previewer = true,
        snacks = true,
      },
    },
    monorepo = true,
  },
}
