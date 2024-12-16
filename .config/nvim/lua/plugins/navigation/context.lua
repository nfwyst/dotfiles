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
      vim.cmd('TSContextDisable')
      is_disabled = true
    end
    set_timer(timer, IS_MAC and 500 or 1500, function()
      vim.cmd('TSContextEnable')
      is_disabled = false
    end)
  end
end

local function should_attach(bufnr)
  if not FILETYPE_VALID(bufnr) then
    return false
  end
  if IS_GPT_PROMPT_CHAT(bufnr) then
    return false
  end
  local is_big_file, is_file = IS_BIG_FILE(bufnr, 0.1)
  return is_file and not is_big_file
end

local function is_move_up_or_down(bufnr)
  local var_key = CONSTANTS.PREV_CURSOR_LINE
  local prev_line = GET_BUFFER_VARIABLE(bufnr, var_key)
  local cur_line = vim.fn.line('.')
  SET_BUFFER_VARIABLE(bufnr, var_key, cur_line)
  if not prev_line then
    return false
  end
  return prev_line ~= cur_line
end

local function disable_context_when_move()
  local toggle_context = get_toggle_context()
  AUTOCMD({ 'CursorMoved', 'CursorMovedI' }, {
    group = AUTOGROUP('__disable_context__', { clear = true }),
    callback = function(event)
      if not should_attach(event.buf) then
        return
      end
      if not is_move_up_or_down(event.buf) then
        return
      end
      toggle_context()
    end,
  })
end

local function init(context)
  disable_context_when_move()
  USER_COMMAND('GoToContext', function()
    context.go_to_context()
  end)
end

return {
  'nvim-treesitter/nvim-treesitter-context',
  event = { 'BufReadPre', 'BufNewFile' },
  config = function()
    local context = require('treesitter-context')
    init(context)
    context.setup({
      max_lines = IS_MAC and 5 or 1,
      zindex = 30,
      on_attach = should_attach,
    })
  end,
}
