return {
  "tadaa/vimade",
  event = "VeryLazy",
  opts = {
    fadelevel = 0.7,
    recipe = { "duo", { animate = true } },
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
