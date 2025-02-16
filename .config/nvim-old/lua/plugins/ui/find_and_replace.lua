return {
  'MagicDuck/grug-far.nvim',
  lazy = true,
  config = function()
    require('grug-far').setup({
      minSearchChars = 3,
      maxWorkers = IS_MAC and 4 or 2,
      reportDuration = false,
      maxSearchMatches = 1000,
      normalModeSearch = true,
      engines = {
        ripgrep = {
          extraArgs = '--no-ignore --hidden --glob !node_modules',
        },
      },
    })
  end,
}
