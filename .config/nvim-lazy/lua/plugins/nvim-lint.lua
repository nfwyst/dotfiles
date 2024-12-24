local eslint = { "eslint_d" }
local lint_events = "BufWritePost"

local function enable_lint(event)
  local bufnr = event.buf
  local opt = { bufnr = bufnr }
  if diagnostic.is_enabled(opt) then
    return
  end
  diagnostic.enable(true, opt)
  BUF_VAR(bufnr, CONSTANTS.LINT_INITED, true)
end

AUCMD(lint_events, {
  group = GROUP("PostLint", { clear = true }),
  callback = enable_lint,
})

env.ESLINT_D_PPID = fn.getpid()

return {
  "mfussenegger/nvim-lint",
  opts = function(_, opts)
    local eslint_linter = require("lint").linters.eslint_d
    ---@diagnostic disable-next-line: assign-type-mismatch
    eslint_linter.cmd = function()
      if IS_FILEPATH(ESLINT_BIN_PATH) then
        return ESLINT_BIN_PATH
      end
      return ESLINT_BIN_NAME
    end
    push(eslint_linter.args, {
      "--config",
      function()
        return FIND_FILE(ESLINT_CONFIGS)
      end,
    })

    opts.events = lint_events
    opts.linters_by_ft = {
      javascript = eslint,
      typescript = eslint,
      typescriptreact = eslint,
      javascriptreact = eslint,
      svelte = eslint,
      sh = { "shellcheck" },
      zsh = { "zsh" },
      markdown = { "vale" },
    }
    return opts
  end,
}
