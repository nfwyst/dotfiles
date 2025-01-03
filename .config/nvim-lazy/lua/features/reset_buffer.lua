local function is_tab_indent(bufnr)
  local line_number = math.min(BUF_COUNT(bufnr), 10)
  local lines = BUF_LINES(bufnr, line_number)
  for _, line in ipairs(lines) do
    local pos = string.find(line, "\t", 1, true)
    if pos then
      return true
    end
  end
  return false
end

AUCMD("User", {
  pattern = "SnacksDashboard*",
  group = GROUP("cursor_line_for_dashboard", { clear = true }),
  callback = function(event)
    if event.match == "SnacksDashboardClosed" then
      return
    end

    defer(function()
      ENABLE_CURSORLINE(event.buf)
    end, 10)
  end,
})

local function set_tab(level, expand)
  SET_LOCAL_OPTS({
    expandtab = expand,
    tabstop = level,
    softtabstop = level,
    shiftwidth = level,
  })
end

local function sync_tab(bufnr)
  if not is_tab_indent(bufnr) then
    return
  end
  set_tab(4, false)
  MAP("n", "<leader>cT", function()
    set_tab(2, true)
  end, {
    desc = "Fix Tab Level",
    buffer = bufnr,
  })
end

local function center(bufnr)
  if not STAY_CENTER then
    return
  end
  defer(function()
    RUN_IN_BUF(bufnr, function()
      cmd("normal! zz")
    end)
  end, 10)
end

local function disable_lint(bufnr)
  local inited = BUF_VAR(bufnr, CONSTANTS.LINT_INITED)
  if inited then
    return
  end
  local opt = { bufnr = bufnr }
  local enabled = diagnostic.is_enabled(opt)
  if not enabled then
    return
  end
  diagnostic.enable(false, opt)
end

local function dim_win(bufnr)
  local var_key = CONSTANTS.WIN_DIMED
  local is_actived = BUF_VAR(bufnr, var_key)
  if is_actived then
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

AUCMD({ "BufReadPost", "BufNewFile" }, {
  group = GROUP("reset_buffer_settings", { clear = true }),
  callback = function(event)
    local bufnr = event.buf
    sync_tab(bufnr)
    center(bufnr)
    disable_lint(bufnr)
    dim_win(bufnr)
  end,
})
