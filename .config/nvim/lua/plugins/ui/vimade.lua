return {
  "tadaa/vimade",
  event = "VeryLazy",
  config = function()
    require("vimade").setup({
      fadelevel = 0.7,
      recipe = { "duo", { animate = vim.g.snacks_animate } },
      tint = {
        bg = { rgb = { 255, 255, 255 }, intensity = 0.2 },
        fg = { rgb = { 255, 255, 255 }, intensity = 0.2 },
      },
      blocklist = {
        custom = {
          buf_opts = {
            filetype = { "snacks_terminal", "opencode_terminal" },
            buftype = { "terminal" },
          },
        },
      },
    })

    vim.cmd.VimadeFadeActive()
  end,
}
