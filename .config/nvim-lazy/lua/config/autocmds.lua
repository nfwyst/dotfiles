-- remove aucmd by vim.api.nvim_del_augroup_by_name("lazyvim_wrap_spell")

local keys_to_delete = {
  n = { "<leader>gL" },
  [{ "n", "v" }] = {
    "<leader>cf",
    "<leader>cF",
  },
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

-- show cursor line for specific filetypes
AUCMD("FileType", {
  group = GROUP("cursor_line_for_filetype", { clear = true }),
  pattern = { "lazy", "markdown" },
  callback = function(event)
    defer(function()
      ENABLE_CURSORLINE(event.buf)
    end, 30)
  end,
})
