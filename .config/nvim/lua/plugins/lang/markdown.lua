return {
  "MeanderingProgrammer/render-markdown.nvim",
  lazy = false,
  opts = function(_, opts)
    SET_OPTS({
      mkdp_refresh_slow = 1,
      mkdp_auto_close = 0,
      mkdp_preview_options = { disable_sync_scroll = 1, disable_filename = 1 },
    }, "g")

    local state = require("render-markdown.state")
    local anti_conceal = { enabled = false }
    local opt = {
      render_modes = { "n", "i", "no", "c", "t", "v", "V", "" },
      file_types = MARKDOWN_FILETYPES,
      completions = { blink = { enabled = true } },
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
        enabled = executable("latex2text"),
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
          local win = fn.bufwinid(bufnr)
          if not api.nvim_win_is_valid(win) then
            return
          end

          local modifiable = OPT("modifiable", { buf = bufnr })
          if not modifiable then
            return OPT("concealcursor", { win = win }, "nvic")
          end

          state.get(bufnr).anti_conceal.enabled = true
        end,
      },
    }

    return merge(opts, opt)
  end,
}
