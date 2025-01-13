return {
  "axkirillov/hbac.nvim",
  opts = {
    autoclose = true,
    threshold = IS_LINUX and 1 or 6,
    close_command = function(bufnr)
      Snacks.bufdelete(bufnr)
    end,
    close_buffers_with_windows = false,
  },
}
