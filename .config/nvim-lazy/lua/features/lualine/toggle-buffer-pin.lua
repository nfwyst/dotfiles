local function toggle_buf_pin(bufnr, val)
  local key = CONSTS.IS_BUF_PINNED
  if val then
    return BUF_VAR(bufnr, key, val)
  end

  local value = BUF_VAR(bufnr, key)
  if value == nil then
    return BUF_VAR(bufnr, key, true)
  end

  BUF_VAR(bufnr, key, not value)
end

local keys = {
  { "<leader>bm", "", desc = "auto management" },
  {
    "<leader>bmt",
    function()
      local bufnr = CUR_BUF()
      local bufnrs = require("lualine.components.buffers").bufpos2nr

      if contains(bufnrs, bufnr) then
        toggle_buf_pin(bufnr)
      end
    end,
    desc = "Toggle Pin Current Buffer",
  },
  {
    "<leader>bmc",
    function()
      local bufnrs = require("lualine.components.buffers").bufpos2nr
      for _, bufnr in ipairs(bufnrs) do
        if not BUF_VAR(bufnr, CONSTS.IS_BUF_PINNED) then
          DEL_BUF(bufnr)
        end
      end
    end,
    desc = "Close Unpinned Buffers",
  },
  {
    "<leader>bmp",
    function()
      local bufnrs = require("lualine.components.buffers").bufpos2nr
      for _, bufnr in ipairs(bufnrs) do
        if not BUF_VAR(bufnr, CONSTS.IS_BUF_PINNED) then
          toggle_buf_pin(bufnr, true)
        end
      end
    end,
    desc = "Pin All Buffers",
  },
  {
    "<leader>bmu",
    function()
      local bufnrs = require("lualine.components.buffers").bufpos2nr
      for _, bufnr in ipairs(bufnrs) do
        if BUF_VAR(bufnr, CONSTS.IS_BUF_PINNED) then
          toggle_buf_pin(bufnr, false)
        end
      end
    end,
    desc = "Unpin All Buffers",
  },
  {
    "<leader>bma",
    function()
      AUTO_CLOSE_BUF_ENABLED = not AUTO_CLOSE_BUF_ENABLED
    end,
    desc = "Toggle Autoclose Buffers",
  },
}

return { keys = keys }
