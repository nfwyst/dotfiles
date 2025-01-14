local function toggle_buf_pin(bufnr, val)
  local name = CONSTS.IS_BUF_PINNED
  if not IS_BUF_LISTED(bufnr) then
    return
  end
  if val then
    return BUF_VAR(bufnr, name, val)
  end
  local value = BUF_VAR(bufnr, name)
  if value == nil then
    return BUF_VAR(bufnr, name, true)
  end
  BUF_VAR(bufnr, name, not value)
end

local name = "hbac.command.actions"

return {
  "axkirillov/hbac.nvim",
  event = "VeryLazy",
  keys = {
    { "<leader>bm", "", desc = "auto management" },
    {
      "<leader>bmt",
      function()
        local bufnr = require(name).toggle_pin()
        toggle_buf_pin(bufnr)
      end,
      desc = "Toggle Pin Current Buffer",
    },
    {
      "<leader>bmc",
      function()
        require(name).close_unpinned()
      end,
      desc = "Close Unpinned Buffers",
    },
    {
      "<leader>bmp",
      function()
        require(name).pin_all()
        toggle_buf_pin(CUR_BUF(), true)
      end,
      desc = "Pin All Buffers",
    },
    {
      "<leader>bmu",
      function()
        require(name).unpin_all()
        toggle_buf_pin(CUR_BUF(), false)
      end,
      desc = "Unpin All Buffers",
    },
    {
      "<leader>bma",
      function()
        require("hbac").toggle_autoclose()
      end,
      desc = "Toggle Autoclose Buffers",
    },
  },
  opts = {
    autoclose = true,
    threshold = IS_LINUX and 3 or 7,
    close_command = function(bufnr)
      Snacks.bufdelete(bufnr)
    end,
    close_buffers_with_windows = false,
  },
}
