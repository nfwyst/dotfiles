return {
  "folke/lazydev.nvim",
  dependencies = {
    { "justinsgithub/wezterm-types", cond = not LINUX },
  },
  opts = function(_, opts)
    PUSH(opts.library, {
      path = "wezterm-types",
      mods = { "wezterm" },
    })
    return opts
  end,
}
