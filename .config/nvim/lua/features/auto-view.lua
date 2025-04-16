local group = GROUP("auto_use_view", { clear = true })
local mods = { emsg_silent = true }
local key = CONSTS.VIEW_ACTIVATED

-- save view with mkview for real files
AUCMD({ "BufWinLeave", "BufWritePost", "WinLeave" }, {
  group = group,
  callback = function(event)
    if not BUF_VAR(event.buf, key) then
      return
    end

    cmd.mkview({ mods = mods })
  end,
})

-- try to load file view if available and enable view saving for real files
AUCMD("BufWinEnter", {
  group = group,
  callback = function(event)
    local bufnr = event.buf
    if BUF_VAR(bufnr, key) then
      return
    end

    if not IS_FILEPATH(BUF_PATH(bufnr)) then
      return
    end

    local opt = { buf = bufnr }
    local filetype = OPT("filetype", opt)
    local ignored = { "gitcommit", "gitrebase", "svg", "hgcommit" }
    if contains(ignored, filetype) then
      return
    end

    cmd.loadview({ mods = mods })
    local win = fn.bufwinid(bufnr)
    defer(function()
      local pos = WIN_CURSOR(win)
      cmd.loadview({ mods = mods })
      if pos[1] ~= WIN_CURSOR(win)[1] then
        WIN_CURSOR(win, pos)
      end
    end, 500)
    BUF_VAR(bufnr, key, true)
  end,
})
