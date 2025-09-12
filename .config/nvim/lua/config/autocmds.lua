-- Autocmds are automatically loaded on the VeryLazy event
-- Default autocmds that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/autocmds.lua
--
-- Add any additional autocmds here
-- with `vim.api.nvim_create_autocmd`
--
-- Or remove existing autocmds by their group name (which is prefixed with `lazyvim_` for the defaults)
-- e.g. vim.api.nvim_del_augroup_by_name("lazyvim_wrap_spell")
local bufread_group = vim.api.nvim_create_augroup("vimade_active", { clear = true })
vim.api.nvim_create_autocmd({ "BufReadPost", "BufNewFile" }, {
  group = bufread_group,
  callback = function(event)
    if not package.loaded.vimade then
      return
    end

    local bufnr = event.buf
    local win = vim.fn.bufwinid(bufnr)
    if not vim.api.nvim_win_is_valid(win) then
      return
    end

    vim.api.nvim_win_call(win, function()
      pcall(vim.cmd.VimadeFadeActive)
    end)
  end,
})

local function center_buf(event)
  local buf = event.buf
  local buflisted = vim.api.nvim_get_option_value("buflisted", { buf = buf })
  if not buflisted then
    return
  end

  local readable = vim.fn.filereadable(vim.api.nvim_buf_get_name(buf))
  if not readable then
    return
  end

  local win = vim.fn.bufwinid(buf)
  if not vim.api.nvim_win_is_valid(win) then
    return
  end

  local pos = vim.api.nvim_win_get_cursor(win)
  local row = pos[1]
  local col = pos[2]

  if vim.b.last_line == nil then
    vim.b.last_line = row
  end

  if row ~= vim.b.last_line then
    local mode = vim.api.nvim_get_mode().mode

    local view = vim.fn.winsaveview()

    local winheight = vim.fn.winheight(win)
    local scroll_offset = math.floor(winheight / 3) + 4
    local new_topline = math.max(1, row - scroll_offset)

    view.topline = new_topline
    vim.fn.winrestview(view)

    if mode:match("^i") then
      vim.api.nvim_win_set_cursor(win, { row, col })
    end

    vim.b.last_line = row
  end
end

local cursor_moved_group = vim.api.nvim_create_augroup("cursor_is_moved", { clear = true })
vim.api.nvim_create_autocmd({ "CursorMoved", "CursorMovedI" }, {
  group = cursor_moved_group,
  callback = center_buf,
})

local buffer_entered_group = vim.api.nvim_create_augroup("buffer_entered", { clear = true })
vim.api.nvim_create_autocmd("BufEnter", {
  group = buffer_entered_group,
  callback = center_buf,
})
