local anti_conceal = { enabled = false }

return {
  "MeanderingProgrammer/render-markdown.nvim",
  ft = vim.g.markdowns,
  opts = {
    render_modes = { "n", "c", "t", "i" },
    preset = "lazy",
    file_types = vim.g.markdowns,
    completions = { blink = { enabled = false } },
    paragraph = { render_modes = true },
    document = { render_modes = true },
    indent = { enabled = false },
    dash = { render_modes = true },
    bullet = { render_modes = true },
    quote = { render_modes = true },
    pipe_table = { render_modes = true },
    link = { render_modes = true },
    inline_highlight = { render_modes = true },
    heading = {
      sign = true,
      render_modes = true,
      icons = { "󰎥 ", "󰎨 ", "󰎫 ", "󰎲 ", "󰎯 ", "󰎴 " },
    },
    code = {
      width = "full",
      render_modes = true,
    },
    checkbox = {
      enabled = true,
      render_modes = true,
    },
    overrides = {
      buflisted = { [false] = { anti_conceal = anti_conceal } },
      buftype = { nofile = { anti_conceal = anti_conceal } },
    },
    latex = {
      enabled = vim.fn.executable("latex2text") == 1,
      render_modes = true,
    },
    html = {
      tag = { think = { icon = "󰛨 ", highlight = "Normal" } },
      render_modes = true,
    },
    on = {
      render = function(context)
        local bufnr = context.buf
        local buflisted = vim.bo[bufnr].buflisted
        local buftype = vim.bo[bufnr].buftype
        if buflisted and buftype ~= "nofile" then
          return
        end

        local modifiable = vim.bo[bufnr].modifiable
        if not modifiable then
          return
        end

        require("render-markdown.state").get(bufnr).anti_conceal.enabled = true
      end,
    },
  },
}
