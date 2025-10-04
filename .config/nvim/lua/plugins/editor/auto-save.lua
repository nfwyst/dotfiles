return {
  "okuuva/auto-save.nvim",
  lazy = false,
  keys = {
    { "<leader>uu", "<cmd>ASToggle<CR>", desc = "Toggle Auto Save" },
  },
  opts = {
    condition = function(bufnr)
      local diagnostic_info = vim.diagnostic.count(bufnr, { severity = vim.diagnostic.severity.ERROR })
      return not diagnostic_info[1] and not vim.api.nvim_buf_get_name(bufnr):match("todo.md$")
    end,
  },
}
