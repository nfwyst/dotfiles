local root = LazyVim.root.get() .. "/"

local function parse_bookmark_value(value)
  return string.match(value or "", "(.-):(%d+):(%d+)(.*)")
end

local function on_select_bookmark_value(value)
  local filepath, row, col = parse_bookmark_value(value)
  if filepath then
    cmd.edit(root .. filepath)
    WIN_CURSOR(CUR_WIN(), { tonumber(row), tonumber(col) })
  end
end

local function get_ui_size(title)
  return {
    title = title,
    ui_width_ratio = 0.7,
    height_in_lines = 25,
  }
end

local function win_height(win)
  local height = api.nvim_win_get_height(win)
  return height - 2 * wo[win].scrolloff
end

local function get_previewer()
  local builtin = require("fzf-lua.previewer.builtin")
  local previewer = builtin.base:extend()

  previewer.new = function(self, ...)
    previewer.super.new(self, ...)
    setmetatable(self, previewer)
    return self
  end

  previewer.populate_preview_buf = function(self, bookmark_value)
    local bufnr = self:get_tmp_buffer()
    local filepath, row, col = parse_bookmark_value(bookmark_value)
    filepath = root .. filepath

    local lines = fn.readfile(filepath)
    api.nvim_buf_set_lines(bufnr, 0, -1, false, lines)
    bo[bufnr].filetype = vim.filetype.match({ filename = filepath })
    api.nvim_buf_add_highlight(bufnr, -1, "Cursor", row - 1, 0, -1)

    defer(function()
      local winid = self.win.preview_winid
      RUN_IN_WIN(winid, function()
        local scroll_row = row - 2 - math.floor(win_height(winid) / 2)
        if scroll_row > 0 then
          cmd.normal({ scroll_row .. "", bang = true })
          cmd.normal({ col .. "", bang = true })
        end
      end)
    end, 50)

    self:set_preview_buf(bufnr)
    self.win:update_scrollbar()
  end

  previewer.gen_winopts = function(self)
    return shadow_merge(self.winopts, {
      wrap = false,
      number = false,
      cursorline = false,
    })
  end

  return previewer
end

local function delete_harpoon_bookmark(on_done)
  return function(selected)
    local bookmarks = require("harpoon"):list("bookmarks")
    local items = bookmarks.items

    for index, item in ipairs(items) do
      if item.value == selected[1] then
        table.remove(items, index)
        return on_done()
      end
    end
  end
end

local function show_bookmark()
  local bookmarks = require("harpoon"):list("bookmarks")
  local items = bookmarks.items
  local options = {}
  for _, item in ipairs(items) do
    PUSH(options, item.value)
  end

  local fzf = require("fzf-lua")
  fzf.fzf_exec(options, {
    prompt = "Harpoon Bookmarks ❯ ",
    actions = {
      ["default"] = function(selected)
        on_select_bookmark_value(selected[1])
      end,
      ["ctrl-r"] = {
        delete_harpoon_bookmark(show_bookmark),
        fzf.actions.resume,
      },
      ["btab"] = fzf.utils.fzf_exit,
    },
    previewer = get_previewer(),
  })
end

return {
  "ThePrimeagen/harpoon",
  branch = "harpoon2",
  keys = function()
    return {
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
          harpoon.ui:toggle_quick_menu(harpoon:list(), get_ui_size("Harpoon"))
        end,
        desc = "Harpoon Quick Menu",
      },
      {
        "<s-tab>",
        show_bookmark,
      },
      {
        "<leader>k",
        function()
          local harpoon = require("harpoon")
          local tag = fn.input("Note: ")
          if tag == "" then
            return
          end
          tag = " -- " .. tag
          local bookmarks = harpoon:list("bookmarks")
          local item = bookmarks.config.create_list_item(tag)
          if item then
            bookmarks:prepend(item)
          end
        end,
        desc = "Harpoon Add Bookmark",
      },
    }
  end,
  opts = {
    bookmarks = {
      create_list_item = function(tag)
        local win = CUR_WIN()
        local pos = WIN_CURSOR(win)
        local bufpath = BUF_PATH(CUR_BUF())
        if not IS_FILEPATH(bufpath) then
          return
        end
        local row = pos[1]
        local col = pos[2]
        local escaped = root:gsub("[%-%.%+%*%?%^%$%(%)%%]", "%%%1")
        bufpath = bufpath:gsub(escaped, "")
        return { value = bufpath .. ":" .. row .. ":" .. col .. tag }
      end,
      select = function(item)
        on_select_bookmark_value(item.value)
      end,
    },
  },
}
