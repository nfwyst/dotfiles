local function init(context)
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
    })
  end,
}
