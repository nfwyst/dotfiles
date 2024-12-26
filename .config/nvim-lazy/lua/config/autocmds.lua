-- Autocmds are automatically loaded on the VeryLazy event
-- Default autocmds that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/autocmds.lua
--
-- Add any additional autocmds here
-- with `vim.api.nvim_create_autocmd`
--
-- Or remove existing autocmds by their group name (which is prefixed with `lazyvim_` for the defaults)
-- e.g. vim.api.nvim_del_augroup_by_name("lazyvim_wrap_spell")

local keys_to_delete = {
  n = { "<leader>gL" },
  [{ "n", "v" }] = {
    "<leader>cf",
    "<leader>cF",
  },
}

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
