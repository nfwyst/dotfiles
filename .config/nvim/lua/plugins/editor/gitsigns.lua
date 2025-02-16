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
  cond = IS_LAUNCH_FROM_GIT_REPO,
  opts = {
    signs = signs,
    signs_staged = signs,
    max_file_length = MAX_FILE_LENGTH,
    update_debounce = 500,
    preview_config = {
      border = "rounded",
    },
  },
}
