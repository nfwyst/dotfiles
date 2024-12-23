local fe = { "eslint_d" }
local eslint_configs = {
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.yaml",
  ".eslintrc.yml",
  ".eslintrc.json",
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
  "package.json",
}

local function enable_lint(bufnr)
  local opt = { bufnr = bufnr }
  if diagnostic.is_enabled(opt) then
    return
  end
  diagnostic.enable(true, opt)
  BUF_VAR(bufnr, CONSTANTS.LINT_INITED, true)
end

AUCMD("BufWritePost", {
  group = GROUP("PostLint", { clear = true }),
  callback = function(event)
    enable_lint(event.buf)
    vim.cmd.Lint()
  end,
})

local function init(lint)
  CMD("Lint", function()
    pcall(lint.try_lint)
  end, { desc = "Run linter" })
end

return {
  "mfussenegger/nvim-lint",
  cmd = "Lint",
  init = function()
    env.ESLINT_D_PPID = fn.getpid()
  end,
  opts = function(_, opts)
    local lint = require("lint")

    local eslint_linter = lint.linters.eslint_d
    ---@diagnostic disable-next-line: assign-type-mismatch
    eslint_linter.cmd = function()
      local bin_name = "eslint_d"
      local bin_path = DATA_PATH .. "/mason/bin/" .. bin_name
      if IS_FILEPATH(bin_path) then
        return bin_path
      end
      return bin_name
    end
    push(eslint_linter.args, {
      "--config",
      function()
        return FIND_FILE(eslint_configs)
      end,
    })

    init(lint)

    opts.linters_by_ft = {
      javascript = fe,
      typescript = fe,
      typescriptreact = fe,
      javascriptreact = fe,
      svelte = fe,
      sh = { "shellcheck" },
      zsh = { "zsh" },
      markdown = { "vale" },
    }
    return opts
  end,
}
