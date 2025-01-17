return {
  function()
    local current_line = fn.line(".")
    local total_lines = fn.line("$")
    local chars = {
      "██",
      "▇▇",
      "▆▆",
      "▅▅",
      "▄▄",
      "▃▃",
      "▂▂",
      "▁▁",
      "  ",
    }
    local line_ratio = current_line / total_lines
    local index = math.ceil(line_ratio * #chars)
    return chars[index]
  end,
  padding = 0,
}
