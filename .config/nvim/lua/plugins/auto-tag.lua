return {
  "windwp/nvim-ts-autotag",
  cond = not IS_VSCODE,
  event = { "BufReadPre", "BufNewFile" },
  config = function()
    require("nvim-ts-autotag").setup()
  end,
}
