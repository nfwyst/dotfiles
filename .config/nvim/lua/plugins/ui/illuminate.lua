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
    local illuminate = { bg = "#B2D4FC", fg = "#4d2b03", bold = true }
    SET_HL({
      IlluminatedWord = illuminate,
      IlluminatedCurWord = illuminate,
      IlluminatedWordText = illuminate,
      IlluminatedWordRead = illuminate,
      IlluminatedWordWrite = illuminate,
    })
  end,
}
