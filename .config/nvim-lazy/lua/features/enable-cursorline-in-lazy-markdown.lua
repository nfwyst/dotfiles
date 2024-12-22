AUCMD("FileType", {
  group = GROUP("EnableCursorLineForGit", { clear = true }),
  pattern = { "lazy", "markdown" },
  callback = function(event)
    defer(function()
      ENABLE_CURSORLINE(event.buf)
    end, 30)
  end,
})
