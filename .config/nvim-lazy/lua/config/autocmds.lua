-- remove aucmd by vim.api.nvim_del_augroup_by_name("lazyvim_wrap_spell")

local keys_to_delete = {
  n = { "<leader>gL" },
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
