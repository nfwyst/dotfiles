return {
  "folke/lazydev.nvim",
  dependencies = {
    { "justinsgithub/wezterm-types", cond = IS_IN_WEZTERM },
  },
  opts = function(_, opts)
    if not IS_IN_WEZTERM then
      return opts
    end

    local path = "wezterm-types"
    PUSH_WHEN_NOT_EXIST(opts.library, {
      path = path,
      mods = { "wezterm" },
    }, function(v)
      return v.path == path
    end)

    return opts
  end,
}
