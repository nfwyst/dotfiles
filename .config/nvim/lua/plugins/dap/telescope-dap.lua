return {
  "nvim-telescope/telescope-dap.nvim",
  cmd = { "Telescope dap" },
  dependencies = {
    "nvim-telescope/telescope.nvim",
    "mfussenegger/nvim-dap",
  },
  config = function()
    require("telescope").load_extension("dap")
  end,
}
