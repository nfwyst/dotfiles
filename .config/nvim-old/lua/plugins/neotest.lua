local function get_jest_config_path(filepath)
  return FIND_FIRST_FILE_OR_DIR_PATH({
    'jest.config.js',
    'jest.config.ts',
    'jest.config.mjs',
    'jest.config.cjs',
    'jest.config.json',
    'package.json',
  }, filepath)
end

return {
  'nvim-neotest/neotest',
  lazy = true,
  dependencies = {
    'nvim-neotest/nvim-nio',
    'nvim-lua/plenary.nvim',
    'nvim-treesitter/nvim-treesitter',
    'nvim-neotest/neotest-jest',
    'marilari88/neotest-vitest',
  },
  config = function()
    require('neotest').setup({
      adapters = {
        require('neotest-vitest')({
          is_test_file = function(file_path)
            return string.match(file_path, '__tests__')
          end,
          filter_dir = function(name)
            return name ~= 'node_modules'
          end,
        }),
        require('neotest-jest')({
          env = { CI = true },
          jestCommand = 'yarn run test',
          jestConfigFile = get_jest_config_path,
          cwd = function(filepath)
            local config_file_path = get_jest_config_path(filepath)
            if config_file_path then
              return GET_DIR_PATH(config_file_path)
            end
            return GET_PROJECT_ROOT(filepath)
          end,
        }),
      },
      log_level = OFF,
    })
  end,
}
