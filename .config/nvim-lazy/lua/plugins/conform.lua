local fixing = false

local fixer = { "eslint_d" }
local formatter = { "prettierd" }

local function fix_or_format()
  if fixing then
    return fixer
  end
  return formatter
end

local function setup_eslint()
  local eslint_d = require("conform.formatters.eslint_d")
  assign(eslint_d, {
    command = ESLINT_BIN_PATH,
    cwd = require("conform.util").root_file(ESLINT_CONFIGS),
    require_cwd = true,
  })
end

local function setup_prettier()
  local prettierd = require("conform.formatters.prettierd")
  prettierd.command = DATA_PATH .. "/mason/bin/prettierd"
end

local format_opt = {
  timeout_ms = 1000,
  async = true,
}

return {
  "stevearc/conform.nvim",
  keys = {
    {
      "<leader>cF",
      function()
        fixing = false
        require("conform").format(merge(format_opt, {
          formatters = { "injected" },
        }))
      end,
      mode = { "n", "v" },
      desc = "Format Injected Langs",
    },
    {
      "<leader>cf",
      function()
        fixing = false
        LazyVim.format({ force = true })
      end,
      mode = { "n", "v" },
      desc = "Format",
    },
    {
      "<leader>cL",
      function()
        fixing = true
        require("conform").format(format_opt)
      end,
    },
  },
  opts = function(_, opts)
    setup_eslint()
    setup_prettier()
    local opt = {
      log_level = levels.OFF,
      formatters_by_ft = {
        javascript = fix_or_format,
        typescript = fix_or_format,
        javascriptreact = fix_or_format,
        typescriptreact = fix_or_format,
        svelte = fix_or_format,
        css = formatter,
        scss = formatter,
        html = formatter,
        json = formatter,
        jsonc = formatter,
        yaml = formatter,
        graphql = formatter,
        ["markdown"] = { "prettierd", "markdownlint-cli2", "markdown-toc" },
        ["markdown.mdx"] = { "prettierd", "markdownlint-cli2", "markdown-toc" },
        nu = { "nufmt" },
        sh = { "shfmt" },
        zsh = { "beautysh" },
        lua = { "stylua" },
        toml = { "taplo" },
        ["_"] = { "trim_whitespace" },
      },
      formatters = {
        beautysh = function()
          return {
            command = "beautysh",
            args = {
              "-i",
              opt.shiftwidth:get(),
              "$FILENAME",
            },
            stdin = false,
          }
        end,
      },
    }
    return merge(opts, opt)
  end,
}
