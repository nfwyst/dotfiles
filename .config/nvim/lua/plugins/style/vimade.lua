return {
  "tadaa/vimade",
  event = "VeryLazy",
  config = function()
    local Minimalist = require("vimade.recipe.minimalist").Minimalist
    local config = Minimalist({ animate = IS_MAC })
    config.fadelevel = 0.8
    require("vimade").setup(config)
  end,
}
