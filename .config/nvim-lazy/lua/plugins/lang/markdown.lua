local ft = { "markdown", "Avante", "norg", "rmd", "org" }

return {
  "MeanderingProgrammer/render-markdown.nvim",
  opts = {
    file_types = ft,
    code = {
      sign = true,
    },
    heading = {
      sign = true,
      icons = { "󰲡 ", "󰲣 ", "󰲥 ", "󰲧 ", "󰲩 ", "󰲫 " },
    },
  },
  ft = ft,
}
