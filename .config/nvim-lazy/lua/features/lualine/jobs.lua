local _bufnr
local _win

local function is_ctx_valid(win, bufnr)
  return api.nvim_win_is_valid(win) and api.nvim_buf_is_valid(bufnr)
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
    DEL_BUF(_bufnr, true)
    api.nvim_win_close(_win, false)
  end

  set()
end

local function open_dashboard(win, bufnr)
  if _bufnr and _win then
    if is_ctx_valid(_win, _bufnr) then
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

  if should_hide and fn.mode() == "c" or not should_hide then
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
    end
  end, 0)
end

return {
  run_filetype_task = run_filetype_task,
  set_dashboard_win_buf = set,
  close_dashboard = close_dashboard,
  open_dashboard = open_dashboard,
}
