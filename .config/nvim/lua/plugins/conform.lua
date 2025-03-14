local fixer = { "eslint_d" }
local formatter = { "prettierd" }
local md_formatter = { "prettierd", "markdownlint-cli2", "markdown-toc" }

local function fix_or_format()
  if NEED_ESLINT_FIX then
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

return {
  "stevearc/conform.nvim",
  opts = function(_, opts)
    setup_eslint()
    setup_prettier()

    SET_KEYMAP_PRE_HOOK({ "n", "v" }, { "<leader>cf", "<leader>cF" }, function()
      NEED_ESLINT_FIX = false

      local name = ".prettierrc.json"
      if OPT("shiftwidth", { buf = CUR_BUF() }) == 4 then
        name = ".prettierrc_tab.json"
      end

      env.PRETTIERD_DEFAULT_CONFIG = HOME_PATH .. "/.config/" .. name
    end)

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
        ["markdown"] = md_formatter,
        ["markdown.mdx"] = md_formatter,
        nu = { "nufmt" },
        sh = { "shfmt" },
        zsh = { "beautysh" },
        lua = { "stylua" },
        toml = { "taplo" },
        http = { "kulala-fmt" },
        ["_"] = { "trim_whitespace" },
      },
      formatters = {
        beautysh = function()
          local shiftwidth = OPT("shiftwidth", { buf = CUR_BUF() })

          return {
            command = "beautysh",
            args = { "-i", tostring(shiftwidth), "$FILENAME" },
            stdin = false,
          }
        end,
      },
    }
    return merge(opts, opt)
  end,
}
