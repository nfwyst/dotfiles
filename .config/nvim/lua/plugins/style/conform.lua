local c = { "clang_format" }
local is_fixing = false

local function setup_eslint()
  local eslint_d = require("conform.formatters.eslint_d")
  eslint_d.cwd = require("conform.util").root_file(ESLINT_CONFIG_NAMES)
  eslint_d.require_cwd = true
end

local function init(conform)
  setup_eslint()
  local function run()
    conform.format({
      lsp_format = "fallback",
      timeout_ms = 1000,
      async = true,
    })
  end
  SET_USER_COMMANDS({
    Format = function()
      is_fixing = false
      run()
    end,
    FixAll = function()
      is_fixing = true
      run()
    end,
  })
end

local function fe()
  if is_fixing then
    return { "eslint_d" }
  end
  return { "prettierd" }
end

return {
  "stevearc/conform.nvim",
  cmd = { "Format", "ConformInfo" },
  config = function()
    local conform = require("conform")
    init(conform)
    conform.setup({
      log_level = vim.log.levels.OFF,
      formatters_by_ft = {
        javascript = fe,
        typescript = fe,
        javascriptreact = fe,
        typescriptreact = fe,
        svelte = fe,
        css = fe,
        scss = fe,
        html = fe,
        json = fe,
        jsonc = fe,
        markdown = fe,
        yaml = fe,
        graphql = fe,
        c = c,
        cpp = c,
        sh = { "shfmt" },
        zsh = { "beautysh" },
        lua = { "stylua" },
        ["_"] = { "trim_whitespace" },
      },
      formatters = {
        beautysh = function()
          return {
            command = "beautysh",
            args = {
              "-i",
              vim.opt.shiftwidth:get(),
              "$FILENAME",
            },
            stdin = false,
          }
        end,
      },
    })
  end,
}
