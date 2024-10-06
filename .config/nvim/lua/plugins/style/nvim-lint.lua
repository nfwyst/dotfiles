AUTOCMD("BufWritePost", {
  command = "Lint",
  group = AUTOGROUP("_lint_", { clear = true }),
})

local function init(lint)
  USER_COMMAND("Lint", function()
    PCALL(function()
      lint.try_lint()
    end)
  end)
end

local linters = {
  eslint_d = {
    cmd = function()
      local binary_name = "eslint_d"
      local config_file_dir = GET_DIR_MATCH_PATTERNS(ESLINT_CONFIG_NAMES) or ""
      local local_binary = config_file_dir .. "/node_modules/.bin/eslint"
      ---@diagnostic disable-next-line: undefined-field
      return vim.uv.fs_stat(local_binary) and local_binary or binary_name
    end,
    args = {
      "--config",
      function()
        return LOOKUP_FILE_PATH(ESLINT_CONFIG_NAMES)
      end,
    },
  },
}

return {
  "mfussenegger/nvim-lint",
  cmd = "Lint",
  config = function()
    local fe = { "eslint_d" }
    local lint = require("lint")
    for linter_name, config in pairs(linters) do
      local linter = lint.linters[linter_name]
      for key, value in pairs(config) do
        local merger = function(_, val)
          return val
        end
        if type(value) == "table" then
          merger = MERGE_TABLE
          ---@diagnostic disable-next-line: param-type-mismatch
          if vim.islist(value) then
            merger = MERGE_ARRAYS
          end
        end
        linter[key] = merger(linter[key], value)
      end
    end
    lint.linters_by_ft = {
      javascript = fe,
      typescript = fe,
      typescriptreact = fe,
      javascriptreact = fe,
      svelte = fe,
      sh = { "shellcheck" },
      zsh = { "zsh" },
    }
    init(lint)
  end,
}
