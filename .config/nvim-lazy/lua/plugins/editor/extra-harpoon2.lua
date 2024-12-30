local gen_bookmark = function(postfix)
  local win = CUR_WIN()()
  local pos = api.nvim_win_get_cursor(win)
  local buffer_path = BUF_PATH(CUR_BUF)
  local is_file_in_fs = IS_FILEPATH(buffer_path)
  if not is_file_in_fs then
    return
  end
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
  WIN_CURSOR(CUR_WIN(), { bookmark.row, bookmark.col })
end

return {
  "ThePrimeagen/harpoon",
  branch = "harpoon2",
  opts = {
    bookmarks = {
      create_list_item = function(_, postfix)
        local value = gen_bookmark(postfix)
        if value then
          return { value = value }
        end
      end,
      select = function(list_item, _, _)
        on_select(list_item.value)
      end,
    },
  },
  keys = function()
    local keys = {
      {
        "<leader>H",
        function()
          require("harpoon"):list():add()
        end,
        desc = "Harpoon File",
      },
      {
        "<leader>h",
        function()
          local harpoon = require("harpoon")
          harpoon.ui:toggle_quick_menu(harpoon:list())
        end,
        desc = "Harpoon Quick Menu",
      },
    }

    for i = 1, 5 do
      table.insert(keys, {
        "<leader>" .. i,
        function()
          require("harpoon"):list():select(i)
        end,
        desc = "Harpoon to File " .. i,
      })
    end
    return keys
  end,
}

-- TODO: bookmarks, border highlight
