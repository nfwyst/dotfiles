AUCMD("FileType", {
  group = GROUP("show_grug_far_fold", { clear = true }),
  pattern = "grug-far",
  callback = function(event)
    defer(function()
      local win = fn.bufwinid(event.buf)
      wo[win].statuscolumn = ""
    end, 30)
  end,
})
