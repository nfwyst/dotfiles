local function get_size(offset)
  local max_width = MAX_WIDTH(offset)

  local min_width = 15
  if min_width >= max_width then
    min_width = max_width - 2
  end

  return {
    max_width = max_width,
    min_width = min_width < 0 and 0 or min_width,
    width = "auto",
  }
end

local filters = {
  msg_show = {
    "; after #%d+",
    "; before #%d+",
    "%d fewer lines",
    "%d more lines",
    "%d+L, %d+B",
    "%d+ lines ",
    "No lines in buffer",
    "No information available",
    "not found:",
    "hit BOTTOM",
    "hit TOP",
    "No fold found",
    "filetype unknown",
    "DiagnosticChanged",
    "Invalid lnum",
  },
  notify = {
    "method textDocument",
    "Invalid commentstring",
    "Client %d quit with",
    "Failed to parse snippet",
    "This command may require a client extension",
    "file to the chat",
  },
}

local routes = {}
for name, msgs in pairs(filters) do
  local finds = {}
  for _, msg in ipairs(msgs) do
    PUSH(finds, { find = msg })
  end

  PUSH(routes, { filter = { event = name, any = finds } })
end

return {
  "folke/noice.nvim",
  opts = function(_, opts)
    local M = require("noice.util.call")
    function M:log() end

    local opt = {
      routes = routes,
      lsp = {
        hover = {
          silent = IS_LINUX,
        },
        progress = {
          enabled = not IS_LINUX,
        },
        signature = {
          auto_open = {
            enabled = false,
          },
        },
      },
      views = {
        hover = {
          scrollbar = false,
          border = {
            style = "rounded",
            padding = { 0, 1 },
          },
          size = get_size(),
          position = { row = 2, col = 2 },
        },
        cmdline_popup = {
          size = get_size(4),
        },
      },
    }
    return merge(opts, opt)
  end,
}
