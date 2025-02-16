return {
  'folke/lazydev.nvim',
  ft = 'lua',
  dependencies = {
    { 'Bilal2453/luvit-meta' },
    { 'justinsgithub/wezterm-types', cond = IS_MAC },
  },
  config = function()
    ADD_CMP_SOURCE('lazydev', { group_index = 0, priority = 7 })
    require('lazydev').setup({
      library = {
        'lazy.nvim',
        { path = 'luvit-meta/library', words = { 'vim%.uv' } },
        { path = 'wezterm-types', mods = { 'wezterm' } },
      },
    })
  end,
}
