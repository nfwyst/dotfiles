return {
  "tadaa/vimade",
  event = "VeryLazy",
  config = function()
    require("vimade").setup({
      recipe = { "duo", { animate = not LINUX } },
      fadelevel = 0.7,
    })
  end,
}
