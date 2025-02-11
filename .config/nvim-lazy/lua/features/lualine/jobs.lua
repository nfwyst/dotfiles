local _bufnr
local _win

local function is_ctx_valid(win, bufnr)
  return api.nvim_win_is_valid(win) and api.nvim_buf_is_valid(bufnr)
end

local function del_buf(bufnr, wipe)
  ON_BUF_DEL(bufnr)

  if wipe then
    return Snacks.bufdelete({ buf = bufnr, wipe = wipe })
  end

  api.nvim_buf_delete(bufnr, { force = false })
end

local function close_win_with_buf(win, bufnr)
  del_buf(bufnr, true)
  api.nvim_win_close(win, false)
end

local function set(win, bufnr)
  _win = win
  _bufnr = bufnr
end

local function close_dashboard()
  if not _bufnr or not _win then
    return
  end

  if is_ctx_valid(_win, _bufnr) then
    close_win_with_buf(_win, _bufnr)
  end

  set()
end

SET_HLS({
  WinBar1 = { fg = "#fad61d", bold = true },
  WinBar2 = { fg = "#fbe260", bold = true },
})
local function update_winbar(win, bufpath, bufnrs)
  bufpath = "%#WinBar1#" .. fn.fnamemodify(bufpath, ":~")

  local bufcount = "%*%=%#WinBar2#(" .. #bufnrs .. ")"
  local winbar = bufpath .. bufcount
  local opt = { win = win }

  if winbar ~= OPT("winbar", opt) then
    OPT("winbar", opt, winbar)
  end
end

local function open_dashboard(win, bufnr)
  if _bufnr and _win then
    if is_ctx_valid(_win, _bufnr) then
      close_win_with_buf(win, bufnr)
      return
    end
    set()
  end

  ---@diagnostic disable-next-line: missing-fields
  Snacks.dashboard.open({ win = win, buf = bufnr })

  return "dashboard"
end

local function toggle_cursor_visible(filetype)
  local is_hided = HL("Cursor").blend == 100
  local should_hide = contains(FT_HIDE_CURSOR, filetype)
  local mode = api.nvim_get_mode().mode

  if should_hide and mode == "c" or not should_hide then
    -- show Cursor
    if is_hided then
      SET_HLS({ Cursor = { blend = 0 } })
    end
    return
  end

  -- hide cursor
  if not is_hided then
    SET_HLS({ Cursor = { blend = 100 } })
  end
end

local function run_filetype_task(win, bufnr, filetype)
  defer(function()
    local is_same_win = win == CUR_WIN()
    if is_same_win then
      toggle_cursor_visible(filetype)
      local task = FILETYPE_TASK_MAP[filetype]
      if task then
        task(bufnr, win)
      end
      if OPT("linebreak", { win = win }) then
        OPT("linebreak", { win = win }, false)
      end
    end
  end, 0)
end

local function is_buf_referenced(bufnr)
  if fn.bufnr("#") == bufnr then
    return true
  end

  for _, item in ipairs(fn.getqflist()) do
    if item.bufnr == bufnr then
      return true
    end
  end

  for _, win in ipairs(api.nvim_list_wins()) do
    if api.nvim_win_get_buf(win) == bufnr then
      return true
    end

    for _, item in ipairs(fn.getloclist(win)) do
      if item.bufnr == bufnr then
        return true
      end
    end
  end
end

local function auto_close_files(bufnr, context, bufnrs)
  if MEMORY_USAGE < MEMORY_LIMIT or not context.current then
    return
  end

  if #bufnrs <= MAX_OPEND_FILES then
    return
  end

  for _, buf in ipairs(bufnrs) do
    local is_modified = OPT("modified", { buf = buf })
    if buf ~= bufnr and not is_modified and not is_buf_referenced(buf) then
      return del_buf(buf)
    end
  end
end

return {
  run_filetype_task = run_filetype_task,
  set_dashboard_win_buf = set,
  close_dashboard = close_dashboard,
  open_dashboard = open_dashboard,
  auto_close_files = auto_close_files,
  update_winbar = update_winbar,
}
