local timer

AUCMD("FileType", {
  group = GROUP("ShowGrugFarFold", { clear = true }),
  pattern = "grug-far",
  callback = function(event)
    if timer then
      timer:stop()
      timer:close()
      timer = nil
    end
    timer = defer(function()
      local win = fn.bufwinid(event.buf)
      vim.wo[win].statuscolumn = ""
    end, 50)
  end,
})
