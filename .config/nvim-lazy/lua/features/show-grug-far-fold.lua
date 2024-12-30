AUCMD("FileType", {
  group = GROUP("ShowGrugFarFold", { clear = true }),
  pattern = "grug-far",
  callback = function(event)
    defer(function()
      local win = fn.bufwinid(event.buf)
      wo[win].statuscolumn = ""
    end, 30)
  end,
})
