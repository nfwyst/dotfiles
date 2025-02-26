local function remove_qf_normal()
  local start_index = fn.line(".")
  local count = v.count > 0 and v.count or 1
  return start_index, count
end

local function remove_qf_visual()
  local v_start_idx = fn.line("v")
  local v_end_idx = fn.line(".")

  local start_index = math.min(v_start_idx, v_end_idx)
  local count = math.abs(v_end_idx - v_start_idx) + 1
  PRESS_KEYS("<esc>", "x")
  return start_index, count
end

local function remove_qf_item(is_normal)
  return function()
    local start_index
    local count
    if is_normal then
      start_index, count = remove_qf_normal()
    else
      start_index, count = remove_qf_visual()
    end

    local qflist = fn.getqflist()
    for _ = 1, count, 1 do
      table.remove(qflist, start_index)
    end

    fn.setqflist(qflist, "r")
    if EMPTY(qflist, true) then
      return cmd.ccl()
    end

    fn.cursor(start_index, 1)
  end
end

local function fix_qf_position()
  local win = CUR_WIN()
  local height = WIN_HEIGHT(win)
  local pos = WIN_CURSOR(win)

  defer(function()
    WIN_CURSOR(win, pos)
  end, 30)

  PRESS_KEYS("<cr>", "n")

  local is_resize_manully = WIN_VAR(win, CONSTS.RESIZE_MANULLY)
  local standard_height = FILETYPE_SIZE_MAP.qf.height
  local is_standard_height = standard_height == height
  if is_resize_manully or is_standard_height then
    return
  end

  defer(function()
    WIN_HEIGHT(win, standard_height)
  end, 10)
end

local close_cmd
FILETYPE_TASK_MAP.qf = function(bufnr, win)
  if BUF_VAR(bufnr, TASK_KEY) then
    return
  end

  BUF_VAR(bufnr, "snacks_scroll", false)
  defer(function()
    local opts = COLUMN_OPTS(false)
    opts.number = true
    SET_OPTS(opts, { win = win })
  end, 10)

  local opt = { buffer = bufnr }
  MAPS({
    n = {
      { from = "dd", to = remove_qf_item(true), opt = opt },
      { from = "<cr>", to = fix_qf_position, opt = opt },
    },
    x = {
      { from = "d", to = remove_qf_item(), opt = opt },
    },
  })

  if close_cmd then
    api.nvim_del_autocmd(close_cmd)
  end

  close_cmd = AUCMD("WinClosed", {
    buffer = bufnr,
    once = true,
    callback = function()
      ON_BUF_DEL(bufnr)
      close_cmd = nil
    end,
  })

  BUF_VAR(bufnr, TASK_KEY, true)
end
