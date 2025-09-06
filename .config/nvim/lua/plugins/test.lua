local function get_jest_config_path(from)
  local bufnr = vim.api.nvim_get_current_buf()
  local bufinfo = vim.fn.getbufinfo(bufnr)[0]
  if not from and bufinfo.listed then
    from = bufinfo.name
  end
  local path_wraper = vim.fs.find({
    "jest.config.js",
    "jest.config.ts",
    "jest.config.mjs",
    "jest.config.cjs",
    "jest.config.json",
    "package.json",
  }, {
    upward = true,
    path = from,
    stop = vim.fn.expand("~"),
    limit = 1,
  })
  return path_wraper[1]
end

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
      jestConfigFile = get_jest_config_path,
      cwd = function(filepath)
        local confpath = get_jest_config_path(filepath)
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
