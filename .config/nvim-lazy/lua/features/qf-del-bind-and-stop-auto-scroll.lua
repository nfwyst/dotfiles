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

local pos
local leave_cmd
local close_cmd

FILETYPE_TASK_MAP.qf = function(bufnr, win)
  if BUF_VAR(bufnr, TASK_KEY) then
    return
  end

  defer(function()
    local opts = COLUMN_OPTS(false)
    opts.number = true
    SET_OPTS(opts, wo[win])
  end, 10)

  local opt = { buffer = bufnr }
  MAPS({
    n = {
      { from = "dd", to = remove_qf_item(true), opt = opt },
      {
        from = "<cr>",
        to = function()
          pos = WIN_CURSOR(win)
          PRESS_KEYS("<cr>", "n")
        end,
        opt = opt,
      },
    },
    x = {
      { from = "d", to = remove_qf_item(), opt = opt },
    },
  })

  if leave_cmd then
    api.nvim_del_autocmd(leave_cmd)
    leave_cmd = nil
  end

  if close_cmd then
    api.nvim_del_autocmd(close_cmd)
    close_cmd = nil
  end

  leave_cmd = AUCMD("WinLeave", {
    buffer = bufnr,
    callback = function()
      defer(function()
        if api.nvim_win_is_valid(win) then
          WIN_CURSOR(win, pos)
        end
      end, 0)
    end,
  })

  close_cmd = AUCMD("WinClosed", {
    buffer = bufnr,
    once = true,
    callback = function()
      api.nvim_del_autocmd(leave_cmd)
      leave_cmd = nil
      close_cmd = nil
    end,
  })

  BUF_VAR(bufnr, TASK_KEY, true)
end
