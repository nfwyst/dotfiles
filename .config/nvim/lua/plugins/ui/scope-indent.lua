return {
  "lukas-reineke/indent-blankline.nvim",
  event = "VimEnter",
  config = function()
    local hooks = require("ibl.hooks")
    hooks.register(hooks.type.HIGHLIGHT_SETUP, function()
      vim.api.nvim_set_hl(0, "MyIndent", { fg = GET_COLOR().fg2 })
    end)
    require("ibl").setup({
      indent = {
        char = "│",
        tab_char = "│",
        highlight = {
          "MyIndent",
        },
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
