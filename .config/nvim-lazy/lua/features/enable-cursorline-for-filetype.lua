AUCMD("FileType", {
  group = GROUP("cursor_line_for_filetype", { clear = true }),
  pattern = { "lazy", "markdown" },
  callback = function(event)
    defer(function()
      ENABLE_CURSORLINE(event.buf)
    end, 30)
  end,
})
