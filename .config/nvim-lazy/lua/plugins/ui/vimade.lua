return {
  "tadaa/vimade",
  cond = not IS_LINUX,
  event = "VeryLazy",
  config = function()
    require("vimade").setup({
      recipe = { "duo", { animate = not IS_LINUX } },
      fadelevel = 0.7,
    })
  end,
}
