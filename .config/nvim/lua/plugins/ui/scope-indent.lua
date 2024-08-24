return {
  "nvimdev/indentmini.nvim",
  cond = not IS_VSCODE,
  event = "BufEnter */*",
  config = function()
    require("indentmini").setup({
      char = "│",
      exclude = { "markdown" },
      minlevel = 1,
      only_current = false,
    })
  end,
}
