return {
  "dbinagi/nomodoro",
  cmd = { "NomoTimer", "NomoMenu" },
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
