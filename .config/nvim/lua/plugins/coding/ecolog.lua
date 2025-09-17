return {
  "ph1losof/ecolog.nvim",
  branch = "beta",
  lazy = false,
  dependencies = {
    "folke/which-key.nvim",
  },
  keys = {
    { "<leader>cEg", "<cmd>EcologGoto<cr>", desc = "Go To Env File" },
    { "<leader>cEs", "<cmd>EcologSelect<cr>", desc = "Switch Env File" },
    { "<leader>cEl", "<Cmd>EcologShelterLinePeek<cr>", desc = "Peek Line" },
    { "<leader>cEc", "<Cmd>EcologCopy<cr>", desc = "Copy Value Under Cursor" },
    { "<leader>cEi", "<Cmd>EcologInterpolationToggle<cr>", desc = "Toggle Interpolation" },
    { "<leader>cEp", "<cmd>EcologSnacks<cr>", desc = "Open A Picker" },
    { "<leader>cEP", "<cmd>EcologPeek<cr>", desc = "Ecolog Peek Variable" },
    { "<leader>cEt", "<Cmd>EcologShellToggle<cr>", desc = "Toggle Shell Variables" },
    { "<leader>cET", "<cmd>EcologShelterToggle<cr>", desc = "Shelter Toggle" },
  },
  config = function()
    require("which-key").add({
      { "<leader>cE", "environment variable" },
    })
    require("ecolog").setup({
      preferred_environment = "local",
      types = true,
      monorepo = {
        enabled = true,
        auto_switch = true,
      },
      interpolation = {
        enabled = true,
      },
      integrations = {
        blink_cmp = true,
        snacks = true,
      },
      shelter = {
        modules = {
          snacks_previewer = true,
          snacks = true,
        },
      },
    })
  end,
}
