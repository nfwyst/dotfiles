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
    fn.cursor(start_index, 1)
  end
end

local function get_cur_qfitem()
  local row = fn.line(".")
  return fn.getqflist()[row]
end

local function scheduler(opts)
  defer(function()
    if opts.is_timeout() or opts.cond() and opts.done() then
      return
    end

    opts.task()
    scheduler(opts)
  end, opts.interval)
end

local function get_on_qf_cr(win)
  local function cond()
    return win ~= CUR_WIN()
  end

  return function()
    local pos = WIN_CURSOR(win)
    local item = get_cur_qfitem()
    local timeouted
    defer(function()
      timeouted = true
    end, 200)

    local function is_timeout()
      return timeouted
    end

    local function task()
      WIN_CURSOR(win, pos)
    end

    PRESS_KEYS("<cr>", "n")

    local prev_height = WIN_VAR(win, CONSTS.PREV_HEIGHT)
    if prev_height then
      scheduler({
        task = function()
          WIN_HEIGHT(win, prev_height)
        end,
        cond = cond,
        done = function()
          local is_done = prev_height == WIN_HEIGHT(win)
          if is_done then
            task()
          end

          return is_done
        end,
        interval = 1,
        is_timeout = is_timeout,
      })
    else
      scheduler({
        task = task,
        cond = cond,
        done = function()
          local curpos = WIN_CURSOR(win)
          return curpos[1] == pos[1] and curpos[2] == pos[2]
        end,
        interval = 1,
        is_timeout = is_timeout,
      })
    end

    scheduler({
      task = function()
        WIN_CURSOR(fn.bufwinid(item.bufnr), { item.lnum, item.col - 1 })
      end,
      cond = function()
        return CUR_BUF() == item.bufnr
      end,
      done = function()
        local curpos = WIN_CURSOR(CUR_WIN())
        return curpos[1] == item.lnum and curpos[2] == item.col - 1
      end,
      interval = 25,
      is_timeout = is_timeout,
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
      { from = "dd", to = remove_qf_item(true), opt = opt },
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
