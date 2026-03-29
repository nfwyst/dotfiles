local signs = {
  add = { text = "+" },
  change = { text = "~" },
  delete = { text = "-" },
  topdelete = { text = "▔" },
  changedelete = { text = "~" },
  untracked = { text = "┆" },
}

return {
  "lewis6991/gitsigns.nvim",
  keys = {
    {
      "<leader>ghP",
      function()
        package.loaded.gitsigns.preview_hunk()
      end,
      desc = "Preview Hunk",
    },
  },
  opts = {
    signs = signs,
    signs_staged = signs,
    preview_config = {
      border = "rounded",
    },
  },
}
