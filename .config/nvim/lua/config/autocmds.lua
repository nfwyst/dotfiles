-- Autocmds are automatically loaded on the VeryLazy event
-- Default autocmds that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/autocmds.lua
--
-- Add any additional autocmds here
-- with `vim.api.nvim_create_autocmd`
--
-- Or remove existing autocmds by their group name (which is prefixed with `lazyvim_` for the defaults)
-- e.g. vim.api.nvim_del_augroup_by_name("lazyvim_wrap_spell")
vim.api.nvim_create_autocmd("FileType", {
  pattern = vim.g.markdowns,
  callback = function()
    vim.schedule(function()
      vim.o.linebreak = false
    end)
  end,
})

-- Fix E828: Cannot open undo file for writing (filename too long on macOS)
vim.api.nvim_create_autocmd({ "BufReadPre", "BufNewFile" }, {
  group = vim.api.nvim_create_augroup("undo_file_check", { clear = true }),
  callback = function(args)
    local undofile = vim.fn.undofile(vim.api.nvim_buf_get_name(args.buf))
    -- Filename length limit on macOS is 255
    if #vim.fn.fnamemodify(undofile, ":t") > 255 then
      vim.bo[args.buf].undofile = false
    end
  end,
})
