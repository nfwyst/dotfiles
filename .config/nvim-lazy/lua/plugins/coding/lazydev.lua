return {
  "folke/lazydev.nvim",
  dependencies = {
    { "justinsgithub/wezterm-types", cond = HAS_WEZTERM },
  },
  opts = function(_, opts)
    if not HAS_WEZTERM then
      return opts
    end

    PUSH(opts.library, {
      path = "wezterm-types",
      mods = { "wezterm" },
    })

    return opts
  end,
}
