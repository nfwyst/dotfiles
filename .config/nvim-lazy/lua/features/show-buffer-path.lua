function SHOW_WINBAR(opt)
  if IS_ZEN_MODE or EMPTY(opt.file) then
    return
  end

  local bufnr = opt.buf
  defer(function()
    local buf_changed = bufnr ~= CUR_BUF()
    if buf_changed or not IS_BUF_LISTED(bufnr) then
      return
    end

    local buf_count = 0
    for _, info in ipairs(BUF_INFO()) do
      if IS_BUF_LISTED(info) then
        buf_count = buf_count + 1
      end
    end

    opt_local.winbar = "%#WinBar1#%m"
      .. "%#WinBar2#("
      .. buf_count
      .. ") "
      .. "%#WinBar1#"
      .. SHORT_HOME_PATH(BUF_PATH(bufnr))
      .. "%*%=%#WinBar2#"
  end, 30)
end

AUCMD({
  "BufAdd",
  "BufWinEnter",
  "BufNewFile",
}, {
  group = GROUP("WinbarUpdate", { clear = true }),
  callback = SHOW_WINBAR,
})
