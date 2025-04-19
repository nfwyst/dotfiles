local function is_moving_vertically(bufnr)
  local key = CONSTS.PREV_ROW_NUMBER
  local prev_row = BUF_VAR(bufnr, key)
  local row = fn.line(".")
  BUF_VAR(bufnr, key, row)
  if not prev_row then
    return false
  end

  return prev_row ~= row
end

local function get_on_cursor_move()
  local move_timer = uv.new_timer()
  local timeout = 1000

  return function(event)
    local tsc = package.loaded["treesitter-context"]
    if not tsc then
      return
    end

    local bufnr = event.buf
    if IS_BIG_FILE(bufnr) or not is_moving_vertically(bufnr) then
      return
    end

    if tsc.enabled() then
      tsc.disable()
    end

    if move_timer then
      move_timer:stop()
      move_timer:start(timeout, 0, function()
        move_timer:stop()
        schedule(tsc.enable)
      end)
    end
  end
end

return {
  "nvim-treesitter/nvim-treesitter-context",
  keys = {
    {
      "gC",
      function()
        require("treesitter-context").go_to_context()
      end,
      desc = "Goto Super Scope",
    },
  },
  opts = function(_, opts)
    ADD_CURSOR_MOVE_CALLBACK("tscontext", get_on_cursor_move())
    UPDATE_HLS({ TreesitterContext = { bg = IS_LINUX and "#494949" or "#1b1b1b" } })

    local opt = {
      max_lines = PERFORMANCE_MODE and 3 or 10,
      zindex = 25,
      min_window_height = 10,
      on_attach = function(bufnr)
        return not IS_BIG_FILE(bufnr)
      end,
    }

    return merge(opts, opt)
  end,
}
