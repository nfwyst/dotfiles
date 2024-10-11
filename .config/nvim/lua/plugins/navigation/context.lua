local function set_timer(tm, ms, callback, ...)
  local args = { ... }
  tm:stop()
  tm:start(ms, 0, function()
    pcall(vim.schedule_wrap(function(...)
      callback(...)
      tm:stop()
    end))
    UNPACK(args)
  end)
end

local function get_toggle_context()
  ---@diagnostic disable-next-line: undefined-field
  local timer = vim.uv.new_timer()
  local is_disabled = false
  return function()
    if not is_disabled then
      vim.cmd("TSContextDisable")
      is_disabled = true
    end
    set_timer(timer, IS_MAC and 500 or 1500, function()
      vim.cmd("TSContextEnable")
      is_disabled = false
    end)
  end
end

local function should_attach(bufnr)
  local filetype = GET_FILETYPE(bufnr)
  local is_chat = IS_GPT_PROMPT_CHAT(bufnr)
  local invalid = TABLE_CONTAINS(INVALID_FILETYPE, filetype)
  if invalid or is_chat or IS_BIG_FILE(bufnr, nil, 0.1) then
    return false
  end
end

local function is_move_up_or_down()
  local cur_line = vim.fn.line(".")
  local prev_line = vim.b.prev_cursor_line or cur_line
  local is_same_line = cur_line == prev_line
  vim.b.prev_cursor_line = cur_line
  return not is_same_line
end

local function disable_context_when_move()
  local toggle_context = get_toggle_context()
  AUTOCMD({ "CursorMoved", "CursorMovedI" }, {
    group = AUTOGROUP("__disable_context__", { clear = true }),
    callback = function(event)
      local is_move_h = not is_move_up_or_down()
      local no_attach = should_attach(event.buf) == false
      if is_move_h or no_attach then
        return
      end
      toggle_context()
    end,
  })
end

local function init(context)
  disable_context_when_move()
  USER_COMMAND("GoToContext", function()
    context.go_to_context()
  end)
end

return {
  "nvim-treesitter/nvim-treesitter-context",
  event = { "BufReadPre", "BufNewFile" },
  config = function()
    local context = require("treesitter-context")
    init(context)
    context.setup({
      max_lines = 5,
      zindex = 30,
      on_attach = should_attach,
    })
  end,
}
