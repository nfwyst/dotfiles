return {
  "MeanderingProgrammer/render-markdown.nvim",
  lazy = false,
  dependencies = { "saghen/blink.cmp" },
  opts = function(_, opts)
    ADD_BLINK_SOURCE("markdown", nil, {
      enabled = function()
        return OPT("filetype", { buf = CUR_BUF() }) == "markdown"
      end,
      name = "RenderMarkdown",
      module = "render-markdown.integ.blink",
    })

    local state = require("render-markdown.state")
    local anti_conceal = { enabled = false }
    local opt = {
      render_modes = { "n", "i", "no", "c", "t", "v", "V", "" },
      file_types = MARKDOWN_FILETYPES,
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
      },
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
