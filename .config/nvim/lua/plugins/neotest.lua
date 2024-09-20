local patterns = { "/packages/", "/app/", "/apps/" }
local jest_extensions = { "js", "ts", "mjs", "cjs", "json" }

local function get_cwd(filepath)
  for _, pattern in ipairs(patterns) do
    if string.find(filepath, pattern) then
      return string.match(filepath, "(.-/[^/]+/)src")
    end
  end
  return vim.fn.getcwd() .. "/"
end

return {
  "nvim-neotest/neotest",
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
          jestCommand = "yarn run test",
          jestConfigFile = function(filepath)
            for _, extension in ipairs(jest_extensions) do
              local path = get_cwd(filepath) .. "jest.config." .. extension
              if IS_FILE_PATH(path) then
                return path
              end
            end
          end,
          cwd = get_cwd,
        }),
      },
      log_level = vim.log.levels.OFF,
    })
  end,
}
