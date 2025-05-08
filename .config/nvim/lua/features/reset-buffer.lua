local function is_tab_indent(bufnr)
  local total_lines = LINE_COUNT(bufnr)
  local start = math.floor(total_lines / 2)
  local end_row = start + 10
  if end_row > total_lines then
    end_row = total_lines
  end

  local lines = BUF_LINES(bufnr, end_row, start)

  for _, line in ipairs(lines) do
    if STR_CONTAINS(line, "\t") then
      return true
    end
  end

  return false
end

local function set_tab(level, expand, bufnr)
  SET_OPTS({
    expandtab = expand,
    tabstop = level,
    softtabstop = level,
    shiftwidth = level,
  }, { buf = bufnr })
end

local function sync_tab(bufnr)
  if not is_tab_indent(bufnr) then
    return
  end

  OPT("list", { win = fn.bufwinid(bufnr) }, false)
  set_tab(4, false, bufnr)
  MAP("n", "<leader>cT", function()
    set_tab(2, true, bufnr)
  end, {
    desc = "Fix Tab Level",
    buffer = bufnr,
  })
end

local function dim_buf(bufnr)
  if not package.loaded.vimade then
    return
  end

  local var_key = CONSTS.BUF_DIMED
  if BUF_VAR(bufnr, var_key) then
    return
  end

  local win = fn.bufwinid(bufnr)
  RUN_IN_WIN(win, function()
    pcall(function()
      cmd.VimadeFadeActive()
      BUF_VAR(bufnr, var_key, true)
    end)
  end)
end

local function reinitialize_buf(bufnr, event)
  if event == "BufNewFile" then
    defer(function()
      local var_key = CONSTS.BUF_REINITED
      if BUF_VAR(bufnr, var_key) then
        return
      end

      cmd.edit()
      BUF_VAR(bufnr, var_key, true)
    end, 0)
  end
end

AUCMD({ "BufReadPost", "BufNewFile" }, {
  group = GROUP("reset_buffer_settings", { clear = true }),
  callback = function(event)
    local bufnr = event.buf
    sync_tab(bufnr)
    dim_buf(bufnr)
    reinitialize_buf(bufnr, event.event)
  end,
})
