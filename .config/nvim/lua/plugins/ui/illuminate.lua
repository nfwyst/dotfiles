return {
  "RRethy/vim-illuminate",
  event = { "BufReadPost", "BufNewFile" },
  config = function()
    require("illuminate").configure({
      modes_allowlist = { "n", "no", "nt" },
      filetypes_denylist = INVALID_FILETYPE,
      large_file_cutoff = MAX_FILE_LENGTH,
      under_cursor = false,
    })
  end,
}
