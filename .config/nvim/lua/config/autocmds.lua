-- Autocmds are automatically loaded on the VeryLazy event
-- Default autocmds that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/autocmds.lua
--
-- Add any additional autocmds here
-- with `vim.api.nvim_create_autocmd`
--
-- Or remove existing autocmds by their group name (which is prefixed with `lazyvim_` for the defaults)
-- e.g. vim.api.nvim_del_augroup_by_name("lazyvim_wrap_spell")
local util = require("config.util")

vim.api.nvim_create_autocmd({ "CursorMoved", "CursorMovedI" }, {
  group = vim.api.nvim_create_augroup("cursor_is_moved", { clear = true }),
  callback = function(event)
    local bufnr = event.buf
    -- should be listed buffer
    if not vim.bo[bufnr].buflisted then
      return
    end

    -- center current window
    util.center_buf_win(bufnr)
  end,
})

vim.api.nvim_create_autocmd("BufEnter", {
  group = vim.api.nvim_create_augroup("buf_is_entered", { clear = true }),
  callback = function(event)
    local bufnr = event.buf
    -- should be readable file
    if vim.fn.filereadable(vim.api.nvim_buf_get_name(bufnr)) == 0 then
      return
    end

    -- center current window
    util.center_buf_win(bufnr)

    -- delete listed buffer which empty name
    for _, buf in ipairs(vim.api.nvim_list_bufs()) do
      if buf ~= bufnr and vim.bo[buf].buflisted and vim.api.nvim_buf_get_name(buf) == "" then
        Snacks.bufdelete({ buf = buf, force = true })
      end
    end
  end,
})
