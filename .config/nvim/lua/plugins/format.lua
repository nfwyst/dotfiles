local fixer = { "eslint_d" }
local formatter = { "prettierd" }
local md_formatter = { "prettierd", "markdownlint-cli2", "markdown-toc" }
local is_fix_mode = false

local function fix_or_format()
  if is_fix_mode then
    return fixer
  end
  return formatter
end

return {
  "stevearc/conform.nvim",
  keys = {
    {
      "<leader>ci",
      function()
        is_fix_mode = true
        require("conform").format({
          timeout_ms = 3000,
          async = true,
        }, function()
          is_fix_mode = false
        end)
      end,
      mode = { "n", "v" },
      desc = "Format With Eslint",
    },
    {
      "<leader>cF",
      function()
        local name = ".prettierrc.json"
        if vim.api.nvim_get_option_value("shiftwidth", { buf = vim.api.nvim_get_current_buf() }) == 4 then
          name = ".prettierrc_tab.json"
        end
        vim.env.PRETTIERD_DEFAULT_CONFIG = vim.fn.expand("~") .. "/.config/" .. name

        require("conform").format({ formatters = { "injected" }, timeout_ms = 3000 })
      end,
      mode = { "n", "v" },
      desc = "Format Injected Langs",
    },
  },
  opts = {
    log_level = vim.log.levels.OFF,
    formatters_by_ft = {
      javascript = fix_or_format,
      typescript = fix_or_format,
      javascriptreact = fix_or_format,
      typescriptreact = fix_or_format,
      svelte = fix_or_format,
      css = formatter,
      scss = formatter,
      less = formatter,
      html = formatter,
      json = formatter,
      jsonc = formatter,
      yaml = formatter,
      graphql = formatter,
      ["markdown"] = md_formatter,
      ["markdown.mdx"] = md_formatter,
      nu = { "nufmt" },
      sh = { "shfmt" },
      zsh = { "beautysh" },
      lua = { "stylua" },
      toml = { "taplo" },
      http = { "kulala-fmt" },
      nginx = { "nginxfmt" },
      sql = { "sqruff" },
      ["_"] = { "trim_whitespace" },
    },
    formatters = {
      beautysh = function()
        local shiftwidth = vim.api.nvim_get_option_value("shiftwidth", { buf = vim.api.nvim_get_current_buf() })

        return {
          command = "beautysh",
          args = { "-i", tostring(shiftwidth), "$FILENAME" },
          stdin = false,
        }
      end,
    },
  },
}
