local util = require("config.util")
local constant = require("config.constant")
local pkg_name = "npm"
local pkgs = { "bun", "pnpm", "yarn" }

for _, pkg in ipairs(pkgs) do
  if vim.fn.executable(pkg) == 1 then
    pkg_name = pkg
  end
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
    local adapters = opts.adapters or {}
    adapters[#adapters + 1] = require("neotest-vitest")({
      is_test_file = function(file_path)
        return string.match(file_path, "__tests__")
      end,
      filter_dir = function(name)
        return name ~= "node_modules"
      end,
    })
    adapters[#adapters + 1] = require("neotest-jest")({
      env = { CI = true },
      jestCommand = pkg_name .. " run test --no-watch --no-watchAll",
      jestConfigFile = function(filepath)
        return util.get_file_path(constant.JEST, { start_path = filepath, ensure_package = true })
      end,
      cwd = function(filepath)
        local confpath = util.get_file_path(constant.JEST, { start_path = filepath, ensure_package = true })
        if confpath then
          return vim.fs.dirname(confpath)
        end
        return LazyVim.root.get()
      end,
    })

    local opt = {
      log_level = vim.log.levels.OFF,
      adapters = adapters,
    }

    return vim.tbl_deep_extend("force", opts, opt)
  end,
}
