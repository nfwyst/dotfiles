return {
  "MagicDuck/grug-far.nvim",
  lazy = true,
  config = function()
    require("grug-far").setup({
      minSearchChars = 3,
      maxWorkers = 2,
      reportDuration = false,
      maxSearchMatches = 1000,
      engines = {
        ripgrep = {
          -- extraArgs = '--no-ignore --hidden --glob "!node_modules"',
          extraArgs = "--no-ignore --hidden",
        },
      },
    })
  end,
}
