return {
  "folke/noice.nvim",
  opts = {
    routes = {
      {
        filter = {
          event = "msg_show",
          any = {
            {
              find = "; after #%d+",
            },
            {
              find = "; before #%d+",
            },
            {
              find = "%d fewer lines",
            },
            {
              find = "%d more lines",
            },
            {
              find = "%d+L, %d+B",
            },
            {
              find = "%d+ lines ",
            },
          },
        },
      },
    },
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
  },
}
