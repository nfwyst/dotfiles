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

AUCMD("FileType", {
  group = GROUP("DeleteQfItem", { clear = true }),
  pattern = "qf",
  callback = function(event)
    local buf = event.buf
    local win = fn.bufwinid(buf)
    wo[win].relativenumber = false
    MAP("n", "dd", remove_qf_item(true), { buffer = buf })
    MAP("x", "d", remove_qf_item(), { buffer = buf })
  end,
})
