return {
  "axkirillov/hbac.nvim",
  keys = {
    { "<leader>bm", "", desc = "auto management" },
    { "<leader>bmt", "<cmd>Hbac toggle_pin<cr>", desc = "Toggle Pin Current Buffer" },
    { "<leader>bmc", "<cmd>Hbac close_unpinned<cr>", desc = "Close Unpinned Buffers" },
    { "<leader>bmp", "<cmd>Hbac pin_all<cr>", desc = "Pin All Buffers" },
    { "<leader>bmu", "<cmd>Hbac unpin_all<cr>", desc = "Unpin All Buffers" },
    { "<leader>bma", "<cmd>Hbac toggle_autoclose<cr>", desc = "Toggle Autoclose Buffers" },
  },
  opts = {
    autoclose = true,
    threshold = IS_LINUX and 1 or 6,
    close_command = function(bufnr)
      Snacks.bufdelete(bufnr)
    end,
    close_buffers_with_windows = false,
  },
}
