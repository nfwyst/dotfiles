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

FILETYPE_TASK_MAP.qf = function(bufnr, win)
  if BUF_VAR(bufnr, TASK_KEY) then
    return
  end
  wo[win].relativenumber = false
  MAP("n", "dd", remove_qf_item(true), { buffer = bufnr })
  MAP("x", "d", remove_qf_item(), { buffer = bufnr })
  BUF_VAR(bufnr, TASK_KEY, true)
end
