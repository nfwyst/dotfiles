local eslint = { "eslint_d" }
local lint_events = "BufWritePost"
local group = GROUP("enable_linter", { clear = true })

local function enable_lint(event)
  if IS_ZEN_MODE then
    return
  end
  local bufnr = event.buf
  local inited = BUF_VAR(bufnr, CONSTS.LINT_INITED)
  if inited then
    return
  end
  BUF_VAR(bufnr, CONSTS.LINT_INITED, true)
  diagnostic.enable(true, { bufnr = bufnr })
end

env.ESLINT_D_PPID = fn.getpid()

return {
  "mfussenegger/nvim-lint",
  opts = function(_, opts)
    -- enable lint when event occured
    AUCMD(lint_events, {
      group = group,
      callback = enable_lint,
    })

    local eslint_linter = require("lint").linters.eslint_d
    ---@diagnostic disable-next-line: assign-type-mismatch
    eslint_linter.cmd = function()
      if IS_FILEPATH(ESLINT_BIN_PATH) then
        return ESLINT_BIN_PATH
      end
      return ESLINT_BIN_NAME
    end
    push_list(eslint_linter.args, {
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
