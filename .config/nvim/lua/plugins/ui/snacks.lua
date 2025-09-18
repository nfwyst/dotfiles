local header = [[
███╗   ██╗███████╗ ██████╗ ██╗   ██╗██╗███╗   ███╗
████╗  ██║██╔════╝██╔═══██╗██║   ██║██║████╗ ████║
██╔██╗ ██║█████╗  ██║   ██║██║   ██║██║██╔████╔██║
██║╚██╗██║██╔══╝  ██║   ██║╚██╗ ██╔╝██║██║╚██╔╝██║
██║ ╚████║███████╗╚██████╔╝ ╚████╔╝ ██║██║ ╚═╝ ██║
╚═╝  ╚═══╝╚══════╝ ╚═════╝   ╚═══╝  ╚═╝╚═╝     ╚═╝
]]

local function pad_str(str, length, pad_char, is_to_start)
  local len = length - #str
  if len <= 0 then
    return str
  end

  local rep_str = string.rep(pad_char, len)
  if is_to_start then
    return rep_str .. str
  end

  return str .. rep_str
end

local handle = io.popen("fortune")
local align = "center"
if handle then
  align = "left"
  header = handle:read("*a")
  handle:close()

  local max_length = 0
  local lines = vim.split(header, "\n", { trimempty = true })
  for index, line in ipairs(lines) do
    local new_line = line:gsub("\t", "")
    lines[index] = new_line
    local len = #new_line
    if len > max_length then
      max_length = len
    end
  end

  local total_rows = #lines
  for index, line in ipairs(lines) do
    local is_author_line = index > 1 and index == total_rows
    lines[index] = pad_str(line, max_length, " ", is_author_line)
  end

  header = table.concat(lines, "\n")
end

return {
  "folke/snacks.nvim",
  opts = {
    dashboard = {
      preset = { header = header },
      formats = { header = { align = align } },
    },
    animate = { enabled = vim.g.snacks_animate, fps = 120 },
    scope = { debounce = 45 },
    scroll = { enabled = false },
    lazygit = { enabled = false },
    styles = {
      notification = { wo = { wrap = true } },
      terminal = { wo = { winbar = "" } },
    },
    dim = { enabled = true },
    image = { enabled = true },
    picker = {
      layout = {
        preset = "vertical",
        layout = {
          width = 0.88,
          height = 0.88,
        },
      },
      formatters = {
        file = {
          truncate = 160,
        },
      },
    },
    quickfile = { enabled = false },
  },
}
