local function remove_qf_normal(row)
  local start_index = row or fn.line(".")
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
  return function(row)
    local start_index
    local count
    if is_normal then
      start_index, count = remove_qf_normal(row)
    else
      start_index, count = remove_qf_visual()
    end
    local qflist = fn.getqflist()

    for _ = 1, count, 1 do
      table.remove(qflist, start_index)
    end

    fn.setqflist(qflist, "r")
    fn.cursor(start_index, 1)
  end
end

local function get_cur_qfitem()
  local row = fn.line(".")
  return fn.getqflist()[row]
end

local function scheduler(opts)
  defer(function()
    if opts.get_is_timeout() then
      return
    end

    local cond = opts.cond
    if cond and not cond() then
      return scheduler(opts)
    end

    if opts.done() then
      return
    end

    opts.task()
    scheduler(opts)
  end, opts.interval)
end

local remove_qf_item_normal = remove_qf_item(true)

local function get_on_qf_cr(win)
  local function get_is_win_pos_same(winid, pos)
    local _pos = WIN_CURSOR(winid)
    return _pos[1] == pos[1] and _pos[2] == pos[2]
  end

  return function()
    local pos = WIN_CURSOR(win)
    local item = get_cur_qfitem()
    local timeouted
    defer(function()
      timeouted = true
    end, 200)

    local function get_is_timeout()
      return timeouted
    end

    PRESS_KEYS("<cr>", "n")

    local prev_height = WIN_VAR(win, CONSTS.PREV_HEIGHT)
    scheduler({
      cond = function()
        return win ~= CUR_WIN()
      end,
      task = function()
        if prev_height then
          WIN_HEIGHT(win, prev_height)
        end

        WIN_CURSOR(win, pos)
      end,
      done = function()
        local is_same_height = not prev_height or prev_height == WIN_HEIGHT(win)
        return is_same_height and get_is_win_pos_same(win, pos)
      end,
      interval = 2,
      get_is_timeout = get_is_timeout,
    })

    local target_pos = { item.lnum, item.col > 0 and item.col - 1 or 0 }
    local bufnr = item.bufnr
    scheduler({
      cond = function()
        return not IS_DASHBOARD_OPEN and CUR_BUF() == bufnr
      end,
      task = function()
        local total_lines = LINE_COUNT(bufnr)
        if target_pos[1] > total_lines then
          target_pos[1] = total_lines
          NOTIFY("position not exists, quickfix item removed", levels.WARN)
          remove_qf_item_normal(pos[1])
        end

        WIN_CURSOR(CUR_WIN(), target_pos)
      end,
      done = function()
        return get_is_win_pos_same(CUR_WIN(), target_pos)
      end,
      interval = 50,
      get_is_timeout = get_is_timeout,
    })
  end
end

local close_cmd
FILETYPE_TASK_MAP.qf = function(bufnr, win)
  local win_height = WIN_HEIGHT(win)
  if win_height + 2 < o.lines then
    WIN_VAR(win, CONSTS.PREV_HEIGHT, win_height)
  end

  if BUF_VAR(bufnr, TASK_KEY) then
    return
  end

  defer(function()
    local opts = COLUMN_OPTS(false)
    opts.number = true
    SET_OPTS(opts, { win = win })
  end, 10)

  local opt = { buffer = bufnr }
  MAPS({
    n = {
      { from = "dd", to = remove_qf_item_normal, opt = opt },
      { from = "<cr>", to = get_on_qf_cr(win), opt = opt },
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
