local black_list = { "todo.md", "test.js", "test.md" }

return {
  "okuuva/auto-save.nvim",
  lazy = false,
  keys = {
    { "<leader>uu", "<cmd>ASToggle<CR>", desc = "Toggle Auto Save" },
  },
  opts = {
    condition = function(bufnr)
      local filepath = vim.api.nvim_buf_get_name(bufnr)
      for _, filename in ipairs(black_list) do
        if filepath:match(filename .. "$") then
          return false
        end
      end

      local no_error = not vim.diagnostic.count(bufnr, { severity = vim.diagnostic.severity.ERROR })[1]
      local no_snippet = not vim.snippet.active()

      return no_error and no_snippet
    end,
  },
}
