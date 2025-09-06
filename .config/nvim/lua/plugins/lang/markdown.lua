return {
  "MeanderingProgrammer/render-markdown.nvim",
  lazy = false,
  opts = function(_, opts)
    local state = require("render-markdown.state")
    local anti_conceal = { enabled = false }
    local opt = {
      render_modes = { "n", "i", "no", "c", "t", "v", "V", "" },
      file_types = { "markdown", "Avante", "codecompanion", "octo", "grug-far-help", "checkhealth" },
      completions = { blink = { enabled = false } },
      heading = {
        sign = true,
        render_modes = true,
        icons = { "󰎥 ", "󰎨 ", "󰎫 ", "󰎲 ", "󰎯 ", "󰎴 " },
      },
      paragraph = {
        render_modes = true,
        left_margin = 2,
      },
      code = {
        sign = true,
        width = "full",
        render_modes = true,
      },
      document = {
        render_modes = true,
      },
      checkbox = {
        enabled = true,
        render_modes = true,
      },
      overrides = {
        buflisted = {
          [false] = { anti_conceal = anti_conceal },
        },
        buftype = {
          nofile = { anti_conceal = anti_conceal },
        },
      },
      win_options = {
        concealcursor = {
          rendered = "",
        },
      },
      indent = {
        enabled = false,
        icon = "▎",
      },
      latex = {
        enabled = vim.fn.executable("latex2text") == 1,
        render_modes = true,
      },
      html = {
        tag = { think = { icon = "󰛨 ", highlight = "Normal" } },
        render_modes = true,
      },
      dash = { render_modes = true },
      bullet = { render_modes = true },
      quote = { render_modes = true },
      pipe_table = { render_modes = true },
      link = { render_modes = true },
      inline_highlight = { render_modes = true },
      on = {
        render = function(context)
          local bufnr = context.buf
          local win = vim.fn.bufwinid(bufnr)
          if not vim.api.nvim_win_is_valid(win) then
            return
          end

          local modifiable = vim.api.nvim_get_option_value("modifiable", { buf = bufnr })
          if not modifiable then
            return vim.api.nvim_set_option_value("concealcursor", "nvic", { win = win })
          end

          state.get(bufnr).anti_conceal.enabled = true
        end,
      },
    }

    return vim.tbl_deep_extend("force", opts, opt)
  end,
}
