local function get_jest_config_path(from)
  return FIND_FILE({
    "jest.config.js",
    "jest.config.ts",
    "jest.config.mjs",
    "jest.config.cjs",
    "jest.config.json",
    "package.json",
  }, { from = from })
end

return {
  "nvim-neotest/neotest",
  dependencies = {
    "nvim-neotest/nvim-nio",
    "nvim-lua/plenary.nvim",
    "nvim-treesitter/nvim-treesitter",
    "nvim-neotest/neotest-jest",
    "marilari88/neotest-vitest",
  },
  opts = function(_, opts)
    local opt = {
      log_level = levels.OFF,
      adapters = {
        require("neotest-vitest")({
          is_test_file = function(file_path)
            return string.match(file_path, "__tests__")
          end,
          filter_dir = function(name)
            return name ~= "node_modules"
          end,
        }),
        require("neotest-jest")({
          env = { CI = true },
          jestCommand = "yarn run test",
          jestConfigFile = get_jest_config_path,
          cwd = function(filepath)
            local confpath = get_jest_config_path(filepath)
            if confpath then
              return fs.dirname(confpath)
            end
            return LazyVim.root.get()
          end,
        }),
      },
    }
    return merge(opts, opt)
  end,
}
