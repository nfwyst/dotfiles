local util = require("config.util")
local scrolloff = vim.o.scrolloff

return {
  "karb94/neoscroll.nvim",
  opts = {
    pre_hook = function()
      vim.o.scrolloff = 1000
    end,
    post_hook = function()
      vim.o.scrolloff = scrolloff
      util.center_buf(vim.api.nvim_get_current_buf(), true)
    end,
  },
}
