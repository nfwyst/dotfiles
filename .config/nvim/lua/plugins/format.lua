local fixer = { "eslint_d", "retab" }
local formatter = { "prettierd", "retab" }
local md_formatter = { "prettierd", "markdownlint-cli2", "markdown-toc", "retab" }
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
    default_format_opts = { stop_after_first = false },
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
      nu = { "nufmt", "retab" },
      sh = { "shfmt", "retab" },
      zsh = { "beautysh", "retab" },
      lua = { "stylua", "retab" },
      toml = { "taplo", "retab" },
      http = { "kulala-fmt", "retab" },
      nginx = { "nginxfmt", "retab" },
      sql = { "sqruff", "retab" },
      ["_"] = { "trim_whitespace", "retab" },
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
      retab = function()
        vim.cmd.retab()
      end,
    },
  },
}
