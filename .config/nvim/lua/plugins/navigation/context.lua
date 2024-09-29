---@diagnostic disable-next-line: undefined-field
local timer = vim.uv.new_timer()
local is_disabled = false

local function init(context)
  USER_COMMAND("GoToContext", function()
    context.go_to_context()
  end)
  AUTOCMD({ "CursorMoved", "CursorMovedI" }, {
    group = AUTOGROUP("__disable_context__", { clear = true }),
    callback = function(event)
      local buf = event.buf
      local is_file = event.file ~= ""
      local is_chat = IS_GPT_PROMPT_CHAT(buf)
      if is_chat or not is_file then
        return
      end
      if not is_disabled then
        vim.cmd("TSContextDisable")
        is_disabled = true
      end
      SET_TIMER(timer, 500, function()
        vim.cmd("TSContextEnable")
        is_disabled = false
      end)
    end,
  })
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
    })
  end,
}
