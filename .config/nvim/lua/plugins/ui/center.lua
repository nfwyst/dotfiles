return {
  -- "arnamak/stay-centered.nvim",
  "nfwyst/stay-centered.nvim",
  lazy = false,
  name = "stay-centered",
  priority = 1000,
  opts = {
    enabled = true,
    skip_filetypes = MERGE_TABLE(INVALID_FILETYPE, { "Avante" }),
  },
}
