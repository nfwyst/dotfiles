local _bufnr
local _win

local function is_ctx_valid(win, bufnr)
  return api.nvim_win_is_valid(win) and api.nvim_buf_is_valid(bufnr)
end

local function close_win_with_buf(win, bufnr)
  DEL_BUF(bufnr, true)
  api.nvim_win_close(win, false)
end

local function set(win, bufnr)
  _win = win
  _bufnr = bufnr
end

local function close_dashboard(bufnrs)
  if not _bufnr or not _win then
    return
  end

  local pos
  local win
  for _, buf in ipairs(bufnrs) do
    if CUR_BUF() == buf then
      win = fn.bufwinid(buf)
      pos = WIN_CURSOR(win)
    end
  end

  if is_ctx_valid(_win, _bufnr) then
    close_win_with_buf(_win, _bufnr)
  end

  if pos then
    defer(function()
      WIN_CURSOR(win, pos)
    end, 10)
  end

  set()
end

local function update_winbar(win, bufpath, bufnrs)
  if IS_ZEN_MODE or IS_REALTIME_SYMBOLS then
    return
  end

  local bufcount = "%=%#WinBar2#(" .. #bufnrs .. ")"
  bufpath = "%#WinBar1#" .. fn.fnamemodify(bufpath, ":~")
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
    set(win, bufnr)
  end

  ---@diagnostic disable-next-line: missing-fields
  Snacks.dashboard.open({ win = win, buf = bufnr })

  return "dashboard"
end

local function is_command_mode()
  local mode = api.nvim_get_mode().mode
  return contains({ "c", "cr" }, mode)
end

local function toggle_cursor_visible(filetype)
  local is_hided = HL("Cursor").blend == 100
  local should_hide = contains(FT_HIDE_CURSOR, filetype)
  if should_hide and is_command_mode() or not should_hide then
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

local max_files_number = 8
local function auto_close_buf(bufnr, context, bufnrs)
  local is_memory_ok = MEMORY_USAGE and MEMORY_USAGE < MEMORY_LIMIT
  local no_current = not context.current
  local disabled = not AUTO_CLOSE_BUF_ENABLED

  if is_memory_ok or no_current or disabled then
    return
  end

  if #bufnrs <= max_files_number then
    return
  end

  for _, buf in ipairs(bufnrs) do
    local not_current = buf ~= bufnr
    local no_change = not OPT("modified", { buf = buf })
    local no_reference = not is_buf_referenced(buf)
    local no_pin = not BUF_VAR(bufnr, CONSTS.BUF_PINNED)

    if not_current and no_change and no_reference and no_pin then
      return DEL_BUF(buf)
    end
  end
end

local function set_dashboard_win_buf(win, bufnr)
  local should_close = _bufnr and _bufnr ~= bufnr
  if should_close and is_ctx_valid(_win, _bufnr) then
    close_win_with_buf(_win, _bufnr)
  end

  set(win, bufnr)
end

local function sync_lsp_hl()
  local clients = lsp.get_clients()
  for _, client in ipairs(clients) do
    local client_id = client.id
    local provider = client.server_capabilities.semanticTokensProvider
    if provider then
      local highlighted = provider.full
      local bufnrs = keys(client.attached_buffers)
      provider.full = not IS_SYNTAX_OFF
      for _, bufnr in ipairs(bufnrs) do
        if IS_SYNTAX_OFF and highlighted then
          lsp.semantic_tokens.stop(bufnr, client_id)
        elseif not IS_SYNTAX_OFF and not highlighted then
          lsp.semantic_tokens.start(bufnr, client_id)
        end
      end
    end
  end
end

local function sync_ts_hl()
  local bufnrs = api.nvim_list_bufs()
  local var_key = CONSTS.TS_HL_NOT_SURPPORT
  for _, bufnr in ipairs(bufnrs) do
    local highlighted = BUF_VAR(bufnr, CONSTS.TS_HL_ENABLED)
    local is_bufloaded = api.nvim_buf_is_loaded(bufnr)
    if is_bufloaded and not BUF_VAR(bufnr, var_key) then
      if IS_SYNTAX_OFF and highlighted then
        ts.stop(bufnr)
      elseif not IS_SYNTAX_OFF and not highlighted then
        local ok = pcall(ts.start, bufnr)
        if not ok then
          BUF_VAR(bufnr, var_key, true)
        end
      end
    end
  end
end

local function sync_syntax_off(bufnr)
  local filetype = OPT("filetype", { buf = bufnr })
  local is_on = g.syntax_on
  if filetype == "ghostty" then
    if not is_on then
      cmd.syntax("on")
    end
  elseif is_on then
    pcall(cmd.syntax, "off")
  end

  sync_ts_hl()
  sync_lsp_hl()
end

return {
  run_filetype_task = run_filetype_task,
  set_dashboard_win_buf = set_dashboard_win_buf,
  close_dashboard = close_dashboard,
  open_dashboard = open_dashboard,
  auto_close_buf = auto_close_buf,
  update_winbar = update_winbar,
  sync_syntax_off = sync_syntax_off,
}
