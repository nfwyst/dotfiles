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
  dependencies = {
    {
      "nvim-lualine/lualine.nvim",
      module = false,
      opts = function(_, opts)
        PUSH(opts.sections.lualine_c, {
          function()
            if not package.loaded["nomodoro"] then
              return "🍅"
            end

            return require("nomodoro").status()
          end,
          color = IS_INIT_BG_DARK and { fg = "#04d1f9" } or nil,
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
