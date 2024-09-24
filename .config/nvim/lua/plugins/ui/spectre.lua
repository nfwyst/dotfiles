function init(spectre, state, picker)
  local function sync_signal(k, v)
    if not picker.signal then
      return
    end
    picker.signal[k] = v
  end
  SET_HL({
    NuiComponentsTreeNodeFocused = { link = "CursorLine" },
  })
  SET_USER_COMMANDS({
    ToggleSpectreCase = function()
      spectre.change_options("ignore-case")
      local case = state.options["ignore-case"] or false
      sync_signal("is_case_insensitive_checked", case)
      TIP("ignore-case: " .. tostring(case))
    end,
    ToggleSpectreHidden = function()
      spectre.change_options("hidden")
      local hidden = state.options["hidden"] or false
      sync_signal("is_hidden_checked", hidden)
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
    local picker = require("pickers.spectre")
    spectre.setup({
      open_cmd = "noswapfile vnew",
    })
    init(spectre, state, picker)
  end,
}
