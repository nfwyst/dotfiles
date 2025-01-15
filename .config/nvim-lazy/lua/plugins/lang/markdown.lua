local ft = { "markdown", "Avante", "norg", "rmd", "org", "codecompanion", "octo" }

return {
  "MeanderingProgrammer/render-markdown.nvim",
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
    render_modes = { "n", "i", "no", "c", "t" },
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
  },
  ft = ft,
}
