function init(spectre, state)
  SET_HL({
    NuiComponentsTreeNodeFocused = { link = "CursorLine" },
  })
  SET_USER_COMMANDS({
    ToggleSpectreCase = function()
      spectre.change_options("ignore-case")
      local case = state.options["ignore-case"] or false
      TIP("ignore-case: " .. tostring(case))
    end,
    ToggleSpectreHidden = function()
      spectre.change_options("hidden")
      local hidden = state.options["hidden"] or false
      TIP("hidden: " .. tostring(hidden))
    end,
  })
end

return {
  "nvim-pack/nvim-spectre",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "grapp-dev/nui-components.nvim",
    dependencies = {
      "MunifTanjim/nui.nvim",
    },
  },
  config = function()
    local spectre = require("spectre")
    local state = require("spectre.state")
    spectre.setup({
      open_cmd = "noswapfile vnew",
    })
    init(spectre, state)
  end,
}
