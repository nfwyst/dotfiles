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
    ShowHarpoonBookmarks = function()
      toggle_telescope(harpoon:list("bookmarks"))
    end,
    AddHarpoonBookmark = function()
      local postfix = vim.fn.input("Note: ")
      if postfix ~= "" then
        postfix = " -- " .. postfix
      end
      local bookmarks = harpoon:list("bookmarks")
      local item = bookmarks.config.create_list_item(bookmarks.config, postfix)
      bookmarks:prepend(item)
    end,
  })
  SET_KEY_MAPS({
    n = {
      {
        lhs = "<s-tab>",
        rhs = function()
          harpoon.ui:toggle_quick_menu(
            harpoon:list(),
            { title = "Harpoon list" }
          )
        end,
      },
      {
        lhs = "<tab>",
        rhs = function()
          harpoon.ui:toggle_quick_menu(
            harpoon:list("bookmarks"),
            { title = "Harpoon markbooks" }
          )
        end,
      },
    },
  })
end

local gen_bookmark = function(postfix)
  local pos = vim.api.nvim_win_get_cursor(0)
  local filepath = GET_CURRENT_FILE_PATH()
  local row = pos[1]
  local col = pos[2]
  return filepath .. ":" .. row .. ":" .. col .. postfix
end

local parse_bookmark = function(value)
  local pt = "(.-):(%d+):(%d+)(.*)"
  local path, row, col, _ = string.match(value or "", pt)
  return {
    filepath = path,
    row = tonumber(row),
    col = tonumber(col),
  }
end

return {
  "ThePrimeagen/harpoon",
  branch = "harpoon2",
  cmd = {
    "Telescope harpoon",
    "AddHarpoonFile",
    "ToggleHarpoonQuickMenu",
    "AddHarpoonBookmark",
    "ShowHarpoonBookmarks",
  },
  keys = { "<tab>", "<s-tab>" },
  dependencies = {
    "nvim-lua/plenary.nvim",
    "nvim-telescope/telescope.nvim",
  },
  config = function()
    local harpoon = require("harpoon")
    harpoon:setup({
      menu = {
        width = vim.api.nvim_win_get_width(0) - 4,
      },
      settings = {
        save_on_toggle = true,
      },
      bookmarks = {
        create_list_item = function(_, name)
          return { value = gen_bookmark(name) }
        end,

        select = function(list_item, _, _)
          local bookmark = parse_bookmark(list_item.value)
          vim.cmd.edit(bookmark.filepath)
          vim.api.nvim_win_set_cursor(0, { bookmark.row, bookmark.col })
        end,
      },
    })

    require("telescope").load_extension("harpoon")
    init(harpoon)
  end,
}
