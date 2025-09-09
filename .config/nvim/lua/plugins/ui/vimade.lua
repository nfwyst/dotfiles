return {
  "tadaa/vimade",
  event = "VeryLazy",
  opts = {
    fadelevel = 0.7,
    recipe = { "duo", { animate = false } },
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
  },
}
