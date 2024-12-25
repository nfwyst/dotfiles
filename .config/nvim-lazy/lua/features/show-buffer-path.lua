local function get_buffer_count(on_travel)
  local count = 0
  for _, info in ipairs(BUF_INFO()) do
    if info.listed == 1 then
      local should_count = on_travel(info)
      if should_count then
        count = count + 1
      end
    end
  end
  return count
end

local function set_winbar(bufpath, bufnr)
  local function on_travel(bufinfo)
    local buf = bufinfo.bufnr
    local should_count = buf == bufnr or bo[buf].modified
    if not should_count then
      cmd.bdelete(buf)
    end
    return should_count
  end

  local title = "%#WinBar1#%m"
    .. "%#WinBar2#("
    .. get_buffer_count(on_travel)
    .. ") "
    .. "%#WinBar1#"
    .. SHORT_HOME_PATH(bufpath)
    .. "%*%=%#WinBar2#"
  opt_local.winbar = title
end

AUCMD({ "BufWinEnter", "BufNewFile" }, {
  group = GROUP("WinbarUpdate", { clear = true }),
  callback = function(event)
    local bufnr = event.buf
    if bo[bufnr].buflisted then
      set_winbar(BUF_PATH(bufnr), bufnr)
    end
  end,
})
