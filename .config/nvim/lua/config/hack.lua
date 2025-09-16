local function flash_active(bufnr)
  bufnr = bufnr or vim.api.nvim_get_current_buf()
  local nss = vim.api.nvim_get_namespaces()
  local ns = nss.flash
  if not ns then
    return false
  end
  local marks = vim.api.nvim_buf_get_extmarks(bufnr, ns, 0, -1, { limit = 1 })
  return #marks > 0
end

-- fix cursor set failed
local win_set_cursor = vim.api.nvim_win_set_cursor
vim.api.nvim_win_set_cursor = function(win, pos)
  local cur_win = vim.api.nvim_get_current_win()
  local cur_buf = vim.api.nvim_win_get_buf(cur_win)
  if win == 0 then
    win = cur_win
  end

  -- other window
  if win ~= cur_win then
    return win_set_cursor(win, pos)
  end

  -- not in normal mode
  if string.sub(vim.api.nvim_get_mode().mode, 1, 1) ~= "n" then
    return win_set_cursor(win, pos)
  end

  -- in flash jump mode
  if flash_active(cur_buf) then
    return win_set_cursor(win, pos)
  end

  -- buffer not listed
  local buflisted = vim.api.nvim_get_option_value("buflisted", { buf = cur_buf })
  if not buflisted then
    return win_set_cursor(win, pos)
  end

  -- buffer is not file
  local bufname = vim.api.nvim_buf_get_name(cur_buf)
  local readable = vim.fn.filereadable(bufname)
  if not readable then
    return win_set_cursor(win, pos)
  end

  vim.defer_fn(function()
    win_set_cursor(win, pos)
  end, 25)
end

-- fix goto next/prev diagnostic window flashed by
local next = vim.diagnostic.goto_next
local prev = vim.diagnostic.goto_prev
vim.diagnostic.goto_next = function(opt)
  ---@diagnostic disable-next-line: inject-field
  opt.float = false
  next(opt)
end
vim.diagnostic.goto_prev = function(opt)
  ---@diagnostic disable-next-line: inject-field
  opt.float = false
  prev(opt)
end

-- fix indent guide not work for creating new file
vim.api.nvim_create_autocmd("BufNewFile", {
  group = vim.api.nvim_create_augroup("is_new_file", { clear = true }),
  callback = function(event)
    local bufnr = event.buf
    if not vim.b[bufnr].is_new_file_fixed then
      Snacks.indent.enable()
    end
    vim.b[bufnr].is_new_file_fixed = true
  end,
})
