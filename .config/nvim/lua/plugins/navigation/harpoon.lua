local function toggle_telescope(harpoon_files)
  local file_paths = {}
  for _, item in ipairs(harpoon_files.items) do
    table.insert(file_paths, item.value)
  end

  NEW_PICKER("Harpoon", {}, file_paths, { preview = true })
end

local function init(harpoon)
  SET_HL({ HarpoonBorder = { link = "TelescopeBorder" } })
  SET_USER_COMMANDS({
    AddHarpoonFile = function()
      harpoon:list():add()
    end,
    ToggleHarpoonQuickMenu = function()
      toggle_telescope(harpoon:list())
    end,
  })
  SET_KEY_MAPS({
    n = {
      {
        lhs = "<tab>",
        rhs = function()
          harpoon.ui:toggle_quick_menu(harpoon:list())
        end,
      },
    },
  })
end

return {
  "ThePrimeagen/harpoon",
  branch = "harpoon2",
  cmd = { "Telescope harpoon", "AddHarpoonFile", "ToggleHarpoonQuickMenu" },
  keys = { "<tab>" },
  dependencies = {
    "nvim-lua/plenary.nvim",
    "nvim-telescope/telescope.nvim",
  },
  config = function()
    local harpoon = require("harpoon")
    harpoon:setup()
    require("telescope").load_extension("harpoon")
    init(harpoon)
  end,
}
