return {
  "folke/lazydev.nvim",
  cond = not IS_VSCODE_OR_LEET_CODE,
  dependencies = {
    { "Bilal2453/luvit-meta" },
    { "justinsgithub/wezterm-types" },
  },
  ft = "lua",
  opts = {
    library = {
      "lazy.nvim",
      { path = "luvit-meta/library", words = { "vim%.uv" } },
      { path = "wezterm-types", mods = { "wezterm" } },
    },
  },
}
