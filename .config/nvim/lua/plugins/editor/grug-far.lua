vim.treesitter.language.register("markdown", "grug-far-help")

return {
  "MagicDuck/grug-far.nvim",
  opts = {
    reportDuration = false,
    maxSearchMatches = 2000,
    normalModeSearch = true,
    engines = {
      ripgrep = {
        extraArgs = "--no-ignore --hidden --glob !node_modules",
      },
    },
  },
}
