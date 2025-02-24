-- remove aucmd by vim.api.nvim_del_augroup_by_name("lazyvim_wrap_spell")

local keys_to_delete = {
  n = { "<leader>gL", "<c-up>", "<c-down>", "<c-left>", "<c-right>" },
}

-- remove default keymap
AUCMD("User", {
  pattern = "LazyVimKeymaps",
  once = true,
  callback = function()
    for mode, keys in pairs(keys_to_delete) do
      for _, key in ipairs(keys) do
        pcall(keymap.del, mode, key)
      end
    end
  end,
})

AUCMD("BufDelete", {
  group = GROUP("buffer_delete", { clear = true }),
  callback = function(event)
    ON_BUF_DEL(event.buf)
  end,
})

local function reset_win_size(win, target, totals, totals_offset)
  totals_offset = totals_offset or 0
  if not target then
    return
  end

  if target < 1 then
    target = math.floor(totals * target)
  end

  local func = totals_offset and WIN_HEIGHT or WIN_WIDTH
  local size = func(win)
  local is_full_size = totals + totals_offset == size
  if not is_full_size and size > target then
    func(win, target)
  end
end

AUCMD({ "VimResized", "WinResized" }, {
  group = GROUP("resize_watcher", { clear = true }),
  callback = function(event)
    local bufnr = event.buf
    local win = fn.bufwinid(bufnr)
    if WIN_VAR(win, CONSTS.RESIZE_MANULLY) then
      return
    end

    local filetype = OPT("filetype", { buf = bufnr })
    local conf = FILETYPE_SIZE_MAP[filetype]
    if not conf or conf.ignore_event then
      return
    end

    reset_win_size(win, conf.width, o.columns)
    reset_win_size(win, conf.height, o.lines, -2)
  end,
})
