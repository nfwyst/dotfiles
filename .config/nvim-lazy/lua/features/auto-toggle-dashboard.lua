local _bufnr
local _win

local function on_tabline_title(win, bufnr, filetype, is_file)
  if filetype == "snacks_dashboard" then
    _bufnr = bufnr
    _win = win
    return
  end

  if not is_file or not _bufnr or not _win then
    return
  end

  if api.nvim_win_is_valid(_win) and api.nvim_buf_is_valid(_bufnr) then
    Snacks.bufdelete({ buf = _bufnr, wipe = true })
    api.nvim_win_close(_win, false)
  end

  _win = nil
  _bufnr = nil
end

local function on_update_tabline_title(win, bufnr, has_name)
  if has_name or not IS_BUF_LISTED(bufnr) then
    return
  end

  if _bufnr and _win then
    NOTIFY("Multiple dashboard exists", levels.ERROR)
    return
  end

  ---@diagnostic disable-next-line: missing-fields
  Snacks.dashboard.open({ win = win, buf = bufnr })

  return "dashboard"
end

return {
  on_tabline_title = on_tabline_title,
  on_update_tabline_title = on_update_tabline_title,
}
