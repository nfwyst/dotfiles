local gen_bookmark = function(postfix)
  local win = GET_CURRENT_WIN()
  local pos = vim.api.nvim_win_get_cursor(win)
  local buffer_path = GET_CURRENT_BUFFER_PATH()
  local row = pos[1]
  local col = pos[2]
  return buffer_path .. ":" .. row .. ":" .. col .. postfix
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

local function on_select(value)
  local bookmark = parse_bookmark(value)
  vim.cmd.edit(bookmark.filepath)
  SCROLL_TO(bookmark.row, bookmark.col)
end

local function toggle_telescope(harpoon_files, entry_parser)
  local file_paths = {}
  for _, item in ipairs(harpoon_files.items) do
    table.insert(file_paths, item.value)
  end

  NEW_PICKER("Harpoon", {}, file_paths, {
    preview = true,
    entry_parser = entry_parser,
    on_select = entry_parser and on_select or nil,
  })
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
      toggle_telescope(harpoon:list("bookmarks"), function(entry)
        local entity = entry[1]
        if entry.origin_entity then
          entity = entry.origin_entity
        else
          entry.origin_entity = entity
        end
        local bookmark = parse_bookmark(entity)
        entry[1] = bookmark.filepath
        return entry, bookmark.row
      end)
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
        create_list_item = function(_, postfix)
          return { value = gen_bookmark(postfix) }
        end,
        select = function(list_item, _, _)
          on_select(list_item.value)
        end,
      },
    })

    require("telescope").load_extension("harpoon")
    init(harpoon)
  end,
}
