local function toggle_buf_pin(bufnr, val)
  local key = CONSTS.BUF_PINNED
  if val then
    return BUF_VAR(bufnr, key, val)
  end

  local value = BUF_VAR(bufnr, key)
  if value == nil then
    return BUF_VAR(bufnr, key, true)
  end

  BUF_VAR(bufnr, key, not value)
end

local function bufnrs()
  return require("lualine.components.buffers").bufpos2nr
end

local keys = {
  { "<leader>bm", "", desc = "auto management" },
  {
    "<leader>bmt",
    function()
      local bufnr = CUR_BUF()

      if contains(bufnrs(), bufnr) then
        toggle_buf_pin(bufnr)
      end
    end,
    desc = "Toggle Pin Current Buffer",
  },
  {
    "<leader>bmc",
    function()
      for _, bufnr in ipairs(bufnrs()) do
        if not BUF_VAR(bufnr, CONSTS.BUF_PINNED) then
          DEL_BUF(bufnr)
        end
      end
    end,
    desc = "Close Unpinned Buffers",
  },
  {
    "<leader>bmp",
    function()
      for _, bufnr in ipairs(bufnrs()) do
        if not BUF_VAR(bufnr, CONSTS.BUF_PINNED) then
          toggle_buf_pin(bufnr, true)
        end
      end
    end,
    desc = "Pin All Buffers",
  },
  {
    "<leader>bmu",
    function()
      for _, bufnr in ipairs(bufnrs()) do
        if BUF_VAR(bufnr, CONSTS.BUF_PINNED) then
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
  {
    "<leader>bmd",
    function()
      for _, bufnr in ipairs(bufnrs()) do
        DEL_BUF(bufnr)
      end
    end,
    desc = "Delete All Buffers",
  },
  {
    "<leader>bmo",
    function()
      for _, bufnr in ipairs(bufnrs()) do
        if bufnr ~= CUR_BUF() then
          DEL_BUF(bufnr)
        end
      end
    end,
    desc = "Delete Other Buffers",
  },
}

return { keys = keys }
