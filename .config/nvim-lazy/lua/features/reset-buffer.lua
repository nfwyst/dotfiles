local function is_tab_indent(bufnr)
  local line_count = math.min(LINE_COUNT(bufnr), 10)
  local lines = BUF_LINES(bufnr, line_count)

  for _, line in ipairs(lines) do
    if STR_CONTAINS(line, "\t") then
      return true
    end
  end

  return false
end

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
  local inited = BUF_VAR(bufnr, CONSTS.LINT_INITED)
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
  local var_key = CONSTS.WIN_DIMED
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

local function show_indent_guide(event)
  if event.event == "BufNewFile" then
    defer(function()
      Snacks.indent.enable()
    end, 0)
  end
end

AUCMD({ "BufReadPost", "BufNewFile" }, {
  group = GROUP("reset_buffer_settings", { clear = true }),
  callback = function(event)
    local bufnr = event.buf
    sync_tab(bufnr)
    center(bufnr)
    disable_lint(bufnr)
    dim_win(bufnr)
    show_indent_guide(event)
  end,
})
