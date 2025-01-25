local ft = { "markdown", "Avante", "codecompanion", "octo" }
local anti_conceal = { enabled = false }

return {
  "MeanderingProgrammer/render-markdown.nvim",
  ft = ft,
  dependencies = {
    {
      "saghen/blink.cmp",
      module = false,
      opts = function(_, opts)
        PUSH(opts.sources.default, "markdown")
        opts.sources.providers.markdown = {
          name = "RenderMarkdown",
          module = "render-markdown.integ.blink",
        }
      end,
    },
  },
  opts = {
    render_modes = { "n", "i", "no", "c", "t", "v", "V", "" },
    file_types = ft,
    latex = {
      render_modes = true,
    },
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
    dash = {
      render_modes = true,
    },
    bullet = {
      render_modes = true,
    },
    checkbox = {
      enabled = true,
      render_modes = true,
    },
    quote = {
      render_modes = true,
    },
    pipe_table = {
      render_modes = true,
    },
    link = {
      render_modes = true,
    },
    inline_highlight = {
      render_modes = true,
    },
    html = {
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
        rendered = "nvic",
      },
    },
  },
}
