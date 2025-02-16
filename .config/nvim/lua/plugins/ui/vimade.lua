return {
  "tadaa/vimade",
  cond = not IS_LINUX,
  event = "VeryLazy",
  opts = {
    fadelevel = 0.7,
    recipe = { "duo", { animate = not IS_LINUX } },
    tint = {
      bg = { rgb = { 255, 255, 255 }, intensity = 0.1 },
      fg = { rgb = { 255, 255, 255 }, intensity = 0.1 },
    },
  },
}
