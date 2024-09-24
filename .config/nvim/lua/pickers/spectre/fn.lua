local M = {}

function M.isome(tbl, func)
  for index, item in ipairs(tbl) do
    if func(item, index) then
      return true
    end
  end

  return false
end

function M.debounce(fn, ms)
  ---@diagnostic disable-next-line: undefined-field
  local timer = vim.uv.new_timer()

  local function wrapped_fn(...)
    local args = { ... }
    timer:stop()
    timer:start(ms, 0, function()
      pcall(
        vim.schedule_wrap(function(...)
          fn(...)
          timer:stop()
        end),
        select(1, M.unpack(args))
      )
    end)
  end
  return wrapped_fn, timer
end

function M.ireject(tbl, pred_fn)
  return M.ifilter(tbl, function(value, index)
    return not pred_fn(value, index)
  end)
end

function M.imap(tbl, func)
  return M.ireduce(tbl, function(new_tbl, value, index)
    table.insert(new_tbl, func(value, index))
    return new_tbl
  end, {})
end

function M.trim(str)
  return (str:gsub("^%s*(.-)%s*$", "%1"))
end

function M.kmap(tbl, func)
  return M.kreduce(tbl, function(new_tbl, value, key)
    table.insert(new_tbl, func(value, key))
    return new_tbl
  end, {})
end

function M.ieach(tbl, func)
  for index, element in ipairs(tbl) do
    func(element, index)
  end
end

---@diagnostic disable-next-line: deprecated
M.unpack = table.unpack or unpack

function M.ifilter(tbl, pred_fn)
  return M.ireduce(tbl, function(new_tbl, value, index)
    if pred_fn(value, index) then
      table.insert(new_tbl, value)
    end
    return new_tbl
  end, {})
end

function M.ireduce(tbl, func, acc)
  for i, v in ipairs(tbl) do
    acc = func(acc, v, i)
  end
  return acc
end

function M.kreduce(tbl, func, acc)
  for i, v in pairs(tbl) do
    if type(i) == "string" then
      acc = func(acc, v, i)
    end
  end
  return acc
end

return M
