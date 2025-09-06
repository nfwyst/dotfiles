local filters = {
  msg_show = {
    "; after #%d+",
    "; before #%d+",
    "%d fewer lines",
    "%d more lines",
    "%d+L, %d+B",
    "%d+ lines ",
  },
}

local function append_route(routes)
  for name, msgs in pairs(filters) do
    local finds = {}
    for _, msg in ipairs(msgs) do
      finds[#finds + 1] = { find = msg }
    end

    routes[#routes + 1] = { filter = { event = name, any = finds } }
  end
end

return {
  "folke/noice.nvim",
  opts = function(_, opts)
    local opt = {
      routes = append_route(opts.routes or {}),
      views = {
        hover = {
          scrollbar = true,
          border = {
            style = "rounded",
            padding = { 0, 1 },
          },
          size = { width = "auto" },
          position = { row = 2, col = 2 },
        },
        cmdline_popup = {
          size = { width = "auto" },
        },
      },
    }

    return vim.tbl_deep_extend("force", opts, opt)
  end,
}
