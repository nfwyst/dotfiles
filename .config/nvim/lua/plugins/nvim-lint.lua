local eslint = { "eslint_d" }
local lint_events = { "BufWritePost" }

local function enable_diagnostic_on_save(event)
  if IS_ZEN_MODE or TOGGLE_DIAGNOSTIC_MANUL then
    return
  end

  local opt = { bufnr = event.buf }
  local enabled = diagnostic.is_enabled(opt)
  if not enabled then
    diagnostic.enable(true, opt)
  end
end

env.ESLINT_D_PPID = fn.getpid()

return {
  "mfussenegger/nvim-lint",
  opts = function(_, opts)
    -- enable lint when event occured
    AUCMD(lint_events, {
      group = GROUP("enable_diagnostic_on_event", { clear = true }),
      callback = enable_diagnostic_on_save,
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

    assign(opts, {
      events = lint_events,
      linters_by_ft = {
        javascript = eslint,
        typescript = eslint,
        typescriptreact = eslint,
        javascriptreact = eslint,
        svelte = eslint,
        sh = { "bash" },
        zsh = { "zsh" },
        markdown = { "vale" },
      },
    })

    return opts
  end,
}
