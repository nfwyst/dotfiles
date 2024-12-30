return {
  "folke/lazydev.nvim",
  dependencies = {
    { "justinsgithub/wezterm-types", cond = not LINUX },
  },
  opts = {
    library = {
      { path = "${3rd}/luv/library", words = { "vim%.uv" } },
      { path = "LazyVim", words = { "LazyVim" } },
      { path = "snacks.nvim", words = { "Snacks" } },
      { path = "lazy.nvim", words = { "LazyVim" } },
      { path = "wezterm-types", mods = { "wezterm" } },
    },
  },
}

-- TODO: check opts table override
