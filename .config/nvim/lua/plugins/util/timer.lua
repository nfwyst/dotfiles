return {
  "dbinagi/nomodoro",
  cmd = { "NomoTimer", "NomoMenu" },
  keys = {
    { "<leader>cUt", "", desc = "timer" },
    { "<leader>cUtm", "<cmd>NomoMenu<cr>", desc = "Nomodoro: Menu" },
    {
      "<leader>cUtw",
      function()
        vim.ui.input({ prompt = "Enter minutes: " }, function(result)
          if result then
            vim.cmd.NomoTimer(result)
          end
        end)
      end,
      desc = "Nomodoro: Work With Custom Time",
    },
  },
  opts = {
    work_time = 25,
    short_break_time = 5,
    long_break_time = 15,
    break_cycle = 20,
    menu_available = true,
    texts = {
      on_break_complete = "TIME IS UP!",
      on_work_complete = "TIME IS UP!",
      status_icon = "🍅",
      timer_format = "!%0M:%0S",
    },
    on_work_complete = function()
      vim.notify("It's time to reset")
    end,
    on_break_complete = function()
      vim.notify("It's time to continue")
    end,
  },
}
