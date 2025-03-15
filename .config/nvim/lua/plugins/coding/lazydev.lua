return {
  "folke/lazydev.nvim",
  dependencies = {
    { "justinsgithub/wezterm-types", cond = IS_IN_WEZTERM },
  },
  opts = function(_, opts)
    if not IS_IN_WEZTERM then
      return opts
    end

    PUSH(opts.library, {
      path = "wezterm-types",
      mods = { "wezterm" },
    })

    return opts
  end,
}
