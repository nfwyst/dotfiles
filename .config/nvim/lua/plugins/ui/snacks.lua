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

local exclude = {
  "**/.git/*",
  "node_modules",
  "dist",
  "log",
  ".vscode",
}

return {
  "folke/snacks.nvim",
  keys = {
    { "<leader>T", "", desc = "Checkmate [T]odos" },
    {
      "<leader>T.",
      function()
        local todopath = vim.g.todopath
        local root = vim.fs.dirname(todopath)
        if vim.fn.filereadable(todopath) == 0 then
          vim.fn.mkdir(root, "p")
        end
        Snacks.scratch.open({
          ft = "markdown",
          file = todopath,
        })
      end,
      desc = "Toggle Scratch Todo",
    },
  },
  opts = {
    dashboard = {
      preset = { header = header },
      formats = { header = { align = align } },
    },
    animate = { enabled = vim.g.snacks_animate, fps = 120 },
    scope = { debounce = 45 },
    quickfile = { enabled = true },
    scroll = {
      enabled = true,
      animate = { duration = { total = 125 } },
      animate_repeat = { delay = 50, duration = { total = 25 } },
      filter = function()
        local mode = vim.api.nvim_get_mode().mode
        return not vim.list_contains({ "v", "V", "\22" }, mode)
      end,
    },
    lazygit = { enabled = false },
    styles = {
      notification = { wo = { wrap = true } },
      terminal = { wo = { winbar = "" } },
    },
    dim = { enabled = true },
    image = { enabled = true },
    picker = {
      hidden = true,
      ignored = true,
      exclude = exclude,
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
      sources = {
        files = {
          hidden = true,
          ignored = true,
          exclude = exclude,
        },
      },
      win = {
        input = {
          keys = {
            ["<c-h>"] = { "toggle_hidden", mode = { "i", "n" } },
            ["<c-l>"] = { "toggle_ignored", mode = { "i", "n" } },
          },
        },
        list = {
          keys = {
            ["<c-h>"] = "toggle_hidden",
            ["<c-l>"] = "toggle_ignored",
          },
        },
      },
    },
  },
}
