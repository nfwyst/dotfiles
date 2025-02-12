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

return {
  "folke/noice.nvim",
  opts = function(_, opts)
    local M = require("noice.util.call")
    function M:log() end

    local opt = {
      routes = {
        {
          filter = {
            event = "msg_show",
            any = {
              { find = "; after #%d+" },
              { find = "; before #%d+" },
              { find = "%d fewer lines" },
              { find = "%d more lines" },
              { find = "%d+L, %d+B" },
              { find = "%d+ lines " },
              { find = "No lines in buffer" },
              { find = "No information available" },
              { find = "not found:" },
              { find = "hit BOTTOM" },
              { find = "hit TOP" },
              { find = "No fold found" },
              { find = "filetype unknown" },
            },
          },
        },
        {
          filter = {
            event = "notify",
            any = {
              { find = "method textDocument" },
              { find = "Invalid commentstring" },
              { find = "Client %d quit with" },
              { find = "Failed to parse snippet" },
              { find = "jump_to_single_result" },
            },
          },
        },
      },
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
