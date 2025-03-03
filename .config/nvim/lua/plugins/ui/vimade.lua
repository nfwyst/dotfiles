VIMADE_ENABLED = not IS_LINUX

return {
  "tadaa/vimade",
  cond = VIMADE_ENABLED,
  event = "VeryLazy",
  opts = {
    fadelevel = 0.7,
    recipe = { "duo", { animate = true } },
    tint = {
      bg = { rgb = { 255, 255, 255 }, intensity = 0.1 },
      fg = { rgb = { 255, 255, 255 }, intensity = 0.1 },
    },
  },
}
