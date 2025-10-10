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
            {
              find = "Installed %d+/%d+ languages",
            },
            {
              find = "Parser not available for language",
            },
            {
              find = "Pattern not found:",
            },
          },
        },
      },
      {
        filter = {
          event = "notify",
          any = {
            {
              find = "No information available",
            },
            {
              find = "This command may require a client extension",
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
        size = { width = "auto", max_width = vim.o.columns - 4 },
        position = { row = 2, col = 2 },
      },
      cmdline_popup = {
        size = { width = "auto", max_width = vim.o.columns - 4 },
      },
    },
    messages = {
      view_search = false,
    },
    throttle = 1000 / 120,
  },
}
