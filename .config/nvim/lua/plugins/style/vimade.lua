return {
  "tadaa/vimade",
  event = "VeryLazy",
  config = function()
    local Ripple = require("vimade.recipe.ripple").Ripple
    local config = Ripple({ animate = IS_MAC })
    config.fadelevel = 0.6
    require("vimade").setup(config)
  end,
}
