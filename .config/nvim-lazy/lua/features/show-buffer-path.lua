local function get_buffer_count()
  local count = 0
  for _, info in ipairs(BUF_INFO()) do
    if IS_FILEPATH(info.name) then
      count = count + 1
    end
  end
  return count
end

local function set_winbar(bufpath)
  local title = "%#WinBar1#%m"
    .. "%#WinBar2#("
    .. get_buffer_count()
    .. ") "
    .. "%#WinBar1#"
    .. SHORT_HOME_PATH(bufpath)
    .. "%*%=%#WinBar2#"
  opt_local.winbar = title
end

AUCMD({ "BufWinEnter", "BufNewFile" }, {
  group = GROUP("WinbarUpdate", { clear = true }),
  callback = function(event)
    local bufpath = BUF_PATH(event.buf)

    if event.event == "BufNewFile" then
      return set_winbar(bufpath)
    end

    if IS_FILEPATH(bufpath) then
      set_winbar(bufpath)
    end
  end,
})
