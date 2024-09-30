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
  return function(valid)
    if valid == false then
      return
    end
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
  if invalid or is_chat then
    return false
  end
end

local function disable_context_when_move()
  local toggle_context = get_toggle_context()
  AUTOCMD({ "CursorMoved", "CursorMovedI" }, {
    group = AUTOGROUP("__disable_context__", { clear = true }),
    callback = function(event)
      toggle_context(should_attach(event.buf))
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
