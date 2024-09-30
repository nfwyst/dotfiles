return {
  "lukas-reineke/indent-blankline.nvim",
  event = "VimEnter",
  config = function()
    require("ibl").setup({
      indent = {
        char = "│",
        tab_char = "│",
      },
      scope = {
        show_start = false,
        show_end = false,
      },
      exclude = {
        filetypes = INVALID_FILETYPE,
      },
    })
  end,
}
