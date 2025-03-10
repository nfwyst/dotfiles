return {
  "alexxGmZ/e-ink.nvim",
  -- FIX: LazyHealth auto set this colorscheme
  lazy = true,
  opts = function (_, opts)
    PUSH(BINARY_SCHEMES, "e-ink")

    return opts
  end,
}
