local function is_tab_indent(bufnr)
  local line_number = math.min(BUF_COUNT(bufnr), 10)
  local lines = BUF_LINES(bufnr, line_number)
  for _, line in ipairs(lines) do
    local pos = string.find(line, "\t", 1, true)
    if pos then
      return true
    end
  end
  return false
end

AUCMD({ "BufRead", "BufNewFile" }, {
  group = GROUP("IndentSettings", { clear = true }),
  callback = function(event)
    local bufnr = event.buf
    if not is_tab_indent(bufnr) then
      return
    end
    SET_LOCAL_OPTS({
      expandtab = false,
      tabstop = 4,
      softtabstop = 4,
      shiftwidth = 4,
    })
  end,
})
