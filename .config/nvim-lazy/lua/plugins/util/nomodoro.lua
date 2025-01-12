return {
  "dbinagi/nomodoro",
  cmd = { "NomoTimer", "NomoMenu" },
  dependencies = {
    {
      "nvim-lualine/lualine.nvim",
      module = false,
      opts = function(_, opts)
        PUSH(opts.sections.lualine_c, {
          function()
            return require("nomodoro").status()
          end,
          cond = function()
            return package.loaded["nomodoro"]
          end,
          color = { fg = "#dc322f" },
          padding = { left = 0, right = 1 },
        })
      end,
    },
  },
  opts = {
    work_time = 25,
    short_break_time = 5,
    long_break_time = 15,
    break_cycle = 4,
    menu_available = true,
    texts = {
      on_break_complete = "TIME IS UP!",
      on_work_complete = "TIME IS UP!",
      status_icon = "🍅",
      timer_format = "!%0M:%0S",
    },
    on_work_complete = function()
      NOTIFY("It's time to reset")
    end,
    on_break_complete = function()
      NOTIFY("It's time to continue")
    end,
  },
}
