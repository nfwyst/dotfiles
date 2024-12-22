return {
  "nvim-treesitter/nvim-treesitter-context",
  cond = not LINUX,
  opts = {
    on_attach = function(bufnr)
      return not IS_BIG_FILE(bufnr)
    end,
  },
}
