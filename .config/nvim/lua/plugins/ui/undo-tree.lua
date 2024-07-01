return {
  "debugloop/telescope-undo.nvim",
  cond = not IS_VSCODE_OR_LEET_CODE,
  cmd = { "Telescope undo" },
  dependencies = {
    "nvim-telescope/telescope.nvim",
  },
  opts = {
    extensions = {
      undo = {
        side_by_side = true,
        layout_strategy = "vertical",
        layout_config = {
          preview_height = 0.7,
          height = 0.999,
        },
      },
    },
  },
  config = function(_, opts)
    require("telescope").setup(opts)
    require("telescope").load_extension("undo")
  end,
}
