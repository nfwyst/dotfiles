return {
  'tadaa/vimade',
  event = 'VeryLazy',
  config = function()
    local Duo = require('vimade.recipe.duo').Duo
    local config = Duo({ animate = IS_MAC })
    config.fadelevel = 0.7
    require('vimade').setup(config)
  end,
}
