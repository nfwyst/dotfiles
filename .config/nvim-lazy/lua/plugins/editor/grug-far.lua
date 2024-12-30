return {
  "MagicDuck/grug-far.nvim",
  opts = {
    minSearchChars = 3,
    maxWorkers = LINUX and 2 or nil,
    reportDuration = false,
    maxSearchMatches = LINUX and 1000 or nil,
    normalModeSearch = true,
    engines = {
      ripgrep = {
        extraArgs = "--no-ignore --hidden --glob !node_modules",
      },
    },
  },
}
