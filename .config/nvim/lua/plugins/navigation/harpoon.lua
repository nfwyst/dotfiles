local function toggle_telescope(harpoon_files, conf)
  local file_paths = {}
  for _, item in ipairs(harpoon_files.items) do
    table.insert(file_paths, item.value)
  end

  require("telescope.pickers")
    .new({}, {
      prompt_title = "Harpoon",
      finder = require("telescope.finders").new_table({
        results = file_paths,
      }),
      previewer = conf.file_previewer({}),
      sorter = conf.generic_sorter({}),
    })
    :find()
end

local function init(harpoon)
  local conf = require("telescope.config").values
  SET_HL({ HarpoonBorder = { link = "TelescopeBorder" } })
  SET_USER_COMMANDS({
    AddHarpoonFile = function()
      harpoon:list():add()
    end,
    ToggleHarpoonQuickMenu = function()
      toggle_telescope(harpoon:list(), conf)
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
  cond = not IS_VSCODE_OR_LEET_CODE,
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
