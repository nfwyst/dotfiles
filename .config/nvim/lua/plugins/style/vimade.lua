return {
  'tadaa/vimade',
  event = 'VeryLazy',
  config = function()
    require('vimade').setup({
      recipe = { 'duo', { animate = IS_MAC } },
      fadelevel = 0.7,
    })
  end,
}
