local function del_aucmds(group_names)
  for _, group_name in ipairs(group_names) do
    api.nvim_del_augroup_by_name("lazyvim_" .. group_name)
  end
end

del_aucmds({ "wrap_spell", "last_loc", "resize_splits" })

local keys_to_delete = {
  n = {
    "<leader>gL",
    "<c-up>",
    "<c-down>",
    "<c-left>",
    "<c-right>",
    "<leader>fn",
  },
}

-- remove default keymap
AUCMD("User", {
  pattern = "LazyVimKeymaps",
  once = true,
  callback = function()
    LAZYVIM_KEYMAP_INITED = true
    for mode, keys in pairs(keys_to_delete) do
      for _, key in ipairs(keys) do
        pcall(keymap.del, mode, key)
      end
    end

    SET_KEYMAPS()
    for _, hook in pairs(KEYMAP_PRE_HOOKS) do
      hook()
    end
  end,
})

AUCMD("BufDelete", {
  group = GROUP("buffer_delete", { clear = true }),
  callback = function(event)
    ON_BUF_DEL(event.buf)
  end,
})

local function reset_win_size(win, target, totals, totals_offset)
  if not target then
    return
  end

  if target < 1 then
    target = math.floor(totals * target)
  end

  local func = totals_offset and WIN_HEIGHT or WIN_WIDTH
  local size = func(win)
  local is_full_size = totals + (totals_offset or 0) == size
  if not is_full_size and size > target then
    func(win, target)
  end
end

local function resize_normal_win()
  cmd.tabdo("wincmd =")
  cmd.tabnext(fn.tabpagenr())
end

local function get_filetype_by_subft(filetype)
  for _, sub_ft in ipairs(FILETYPE_SIZE_MAP._sub_fts) do
    if STR_CONTAINS(filetype, sub_ft) then
      return sub_ft
    end
  end

  return filetype
end

local function resize_special_win(event)
  local bufnr = event.buf
  local win = fn.bufwinid(bufnr)
  if WIN_VAR(win, CONSTS.RESIZE_MANUL) then
    return
  end

  local filetype = get_filetype_by_subft(OPT("filetype", { buf = bufnr }))
  local conf = FILETYPE_SIZE_MAP[filetype]
  if not conf or conf.ignore_event then
    return
  end

  reset_win_size(win, conf.width, o.columns)
  reset_win_size(win, conf.height, o.lines, -2)

  return true
end

AUCMD({ "VimResized", "WinResized" }, {
  group = GROUP("resize_watcher", { clear = true }),
  callback = function(event)
    if resize_special_win(event) then
      return
    end

    if event.event == "VimResized" then
      resize_normal_win()
    end
  end,
})

AUCMD("ColorScheme", {
  group = GROUP("scheme_changed", { clear = true }),
  callback = function()
    UPDATE_HLS()
  end,
})

AUCMD({ "CursorMoved", "CursorMovedI" }, {
  group = GROUP("cursor_moved", { clear = true }),
  callback = ON_CURSOR_MOVE,
})
