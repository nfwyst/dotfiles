AUTOCMD('BufWritePost', {
  command = 'Lint',
  group = AUTOGROUP('_lint_', { clear = true }),
})

local function init(lint)
  USER_COMMAND('Lint', function()
    PCALL(function()
      lint.try_lint()
    end)
  end)
end

local linters = {
  eslint_d = {
    cmd = function()
      local global_bin = 'eslint_d'
      local config_file_path = LOOKUP_FILE_PATH(ESLINT_CONFIG_NAMES)
      local config_file_dir
      local postfix
      local subpath = '/.bin/eslint'
      if config_file_path then
        config_file_dir = GET_DIR_PATH(config_file_path)
        postfix = '/node_modules' .. subpath
      end
      if not config_file_dir then
        config_file_dir = LOOKUP_FILE_PATH({ 'node_modules' })
        postfix = subpath
      end
      local bin_path
      if config_file_dir then
        bin_path = config_file_dir .. postfix
      end
      return IS_FILE_PATH(bin_path) and bin_path or global_bin
    end,
    args = {
      function()
        local config_file_path = LOOKUP_FILE_PATH(ESLINT_CONFIG_NAMES)
        if not config_file_path then
          return nil
        end
        return '--config ' .. config_file_path
      end,
    },
  },
}

return {
  'mfussenegger/nvim-lint',
  cmd = 'Lint',
  config = function()
    local fe = { 'eslint_d' }
    local lint = require('lint')
    for linter_name, config in pairs(linters) do
      local linter = lint.linters[linter_name]
      for key, value in pairs(config) do
        local merger = function(_, val)
          return val
        end
        if type(value) == 'table' then
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
      sh = { 'shellcheck' },
      zsh = { 'zsh' },
      markdown = { 'vale' },
    }
    init(lint)
  end,
}
