local black_list = { "todo.md", "test.*" }

return {
  "okuuva/auto-save.nvim",
  lazy = false,
  keys = {
    { "<leader>uu", "<cmd>ASToggle<CR>", desc = "Toggle Auto Save" },
  },
  opts = {
    noautocmd = true,
    condition = function(bufnr)
      local filepath = vim.api.nvim_buf_get_name(bufnr)
      for _, pattern in ipairs(black_list) do
        if filepath:match("/" .. pattern .. "$") then
          return false
        end
      end

      if vim.snippet.active() then
        return false
      end

      local blink = package.loaded["blink.cmp"]
      if blink and blink.is_visible() then
        return false
      end

      local error_number = vim.diagnostic.count(bufnr, { severity = vim.diagnostic.severity.ERROR })[1] or 0
      if error_number > 10 then
        return false
      end

      return true
    end,
  },
}
