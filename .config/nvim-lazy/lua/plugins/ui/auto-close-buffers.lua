return {
  "axkirillov/hbac.nvim",
  opts = {
    autoclose = true,
    threshold = 1,
    close_command = function(bufnr)
      Snacks.bufdelete(bufnr)
    end,
    close_buffers_with_windows = false,
  },
}
