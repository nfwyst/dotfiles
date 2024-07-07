return {
  "nvimdev/indentmini.nvim",
  cond = not IS_VSCODE,
  event = "BufEnter */*",
  config = function()
    require("indentmini").setup({
      char = "│",
      exclude = {},
      minlevel = 1,
    })
  end,
}
