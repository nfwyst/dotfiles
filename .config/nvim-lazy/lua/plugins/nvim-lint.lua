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

local linters = {
  eslint_d = {
    cmd = function()
      local global_bin = "eslint_d"
      local config_file_path = FIND_FILE(eslint_configs)
      local config_file_dir
      local postfix
      local subpath = "/.bin/eslint"
      if config_file_path then
        config_file_dir = fs.dirname(config_file_path)
        postfix = "/node_modules" .. subpath
      end
      if not config_file_dir then
        config_file_dir = FIND_FILE("node_modules")
        postfix = subpath
      end
      local bin_path
      if config_file_dir then
        bin_path = config_file_dir .. postfix
      end
      return IS_FILEPATH(bin_path) and bin_path or global_bin
    end,
    args = {
      "--config",
      function()
        return FIND_FILE(eslint_configs)
      end,
    },
  },
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
  opts = function(_, opts)
    local lint = require("lint")
    for linter_name, config in pairs(linters) do
      local linter = lint.linters[linter_name]
      for key, value in pairs(config) do
        local merger = function(_, val)
          return val
        end
        if type(value) == "table" then
          merger = function(...)
            return merge("force", ...)
          end
          if vim.islist(value) then
            merger = push
          end
        end
        linter[key] = merger(linter[key], value)
      end
    end

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
    init(lint)
    return opts
  end,
}
