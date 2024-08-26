return {
  "nvim-neotest/neotest",
  cond = not IS_VSCODE_OR_LEET_CODE,
  lazy = true,
  dependencies = {
    "nvim-neotest/nvim-nio",
    "nvim-lua/plenary.nvim",
    "nvim-treesitter/nvim-treesitter",
    "nvim-neotest/neotest-jest",
    "marilari88/neotest-vitest",
  },
  config = function()
    require("neotest").setup({
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
          jestCommand = "yarn run test --",
          jestConfigFile = function(file)
            local config_name = "jest.config.js"
            if string.find(file, "/packages/") then
              return string.match(file, "(.-/[^/]+/)src") .. config_name
            end
            return vim.fn.getcwd() .. "/" .. config_name
          end,
          cwd = function(file)
            if string.find(file, "/packages/") then
              return string.match(file, "(.-/[^/]+/)src")
            end
            return vim.fn.getcwd()
          end,
        }),
      },
      log_level = vim.log.levels.OFF,
    })
  end,
}
