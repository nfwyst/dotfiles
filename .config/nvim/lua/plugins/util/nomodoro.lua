return {
  "dbinagi/nomodoro",
  cmd = { "NomoTimer", "NomoMenu" },
  keys = {
    { "<leader>cut", "", desc = "timer" },
    { "<leader>cutm", "<cmd>NomoMenu<cr>", desc = "Nomodoro: Menu" },
    {
      "<leader>cutw",
      function()
        REQUEST_USER_INPUT("Enter minutes: ", function(minutes)
          cmd.NomoTimer(minutes)
        end)
      end,
      desc = "Nomodoro: Work With Custom Time",
    },
  },
  config = function()
    ADD_LUALINE_COMPONENT("lualine_c", {
      function()
        if not package.loaded["nomodoro"] then
          return "🍅"
        end

        return require("nomodoro").status()
      end,
      color = function()
        local color = {}
        if o.background == "dark" then
          color.fg = "#04d1f9"
        end

        return color
      end,
      padding = { left = 0, right = 1 },
    })

    require("nomodoro").setup({
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
    })
  end,
}
