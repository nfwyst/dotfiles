local function enable_view(bufnr)
  local csvview = package.loaded.csvview
  if not csvview then
    return
  end

  if BUF_VAR(bufnr, FILETYPE_TASK_KEY) then
    return
  end

  csvview.enable(bufnr)
  BUF_VAR(bufnr, FILETYPE_TASK_KEY, true)
end

return {
  "hat0uma/csvview.nvim",
  ft = { "csv", "tsv" },
  cmd = { "CsvViewEnable", "CsvViewDisable", "CsvViewToggle" },
  opts = function(_, opts)
    if not FILETYPE_TASK_MAP.csv then
      assign(FILETYPE_TASK_MAP, {
        csv = enable_view,
        tsv = enable_view,
      })
    end

    UPDATE_HLS({
      CsvViewDelimiter = { link = "FloatBorder" },
      CsvViewStickyHeaderSeparator = { link = "FloatBorder" },
    })

    local opt = {
      view = {
        header_lnum = 1,
        display_mode = "border",
      },
      parser = { comments = { "#", "//" } },
      keymaps = {
        textobject_field_inner = { "if", mode = { "o", "x" } },
        textobject_field_outer = { "af", mode = { "o", "x" } },
        jump_next_field_end = { "<Tab>", mode = { "n", "v" } },
        jump_prev_field_end = { "<S-Tab>", mode = { "n", "v" } },
        jump_next_row = { "<Enter>", mode = { "n", "v" } },
        jump_prev_row = { "<S-Enter>", mode = { "n", "v" } },
      },
    }

    return merge(opts, opt)
  end,
}
