local fixer = { "eslint_d" }
local formatter = { "prettierd" }

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

local function add_keymap_pre_hook(modes, lhses, pre_hook)
  for _, mode in ipairs(modes) do
    for _, lhs in ipairs(lhses) do
      local conf = fn.maparg(lhs, mode, false, true)
      if not EMPTY(conf, true) then
        local callback = conf.callback
        if not callback then
          callback = function()
            PRESS_KEYS(conf.rhs, mode:lower())
          end
        end

        local opt = {
          noremap = conf.noremap == 1,
          silent = conf.silent == 1,
          nowait = conf.nowait == 1,
          script = conf.script == 1,
          expr = conf.expr == 1,
          desc = conf.desc,
        }
        local function rhs()
          pre_hook()
          callback()
        end

        if conf.buffer ~= 0 then
          opt.buffer = conf.buffer
        end

        MAP(mode, lhs, rhs, opt)
      end
    end
  end
end

return {
  "stevearc/conform.nvim",
  opts = function(_, opts)
    setup_eslint()
    setup_prettier()

    local prettierd = require("conform.formatters.prettierd")
    add_keymap_pre_hook({ "n", "v" }, { "<leader>cf", "<leader>cF" }, function()
      local v = OPT("shiftwidth", { buf = CUR_BUF() })
      prettierd.args = { "--tab-width", v, "$FILENAME" }
      NEED_ESLINT_FIX = false
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
              o.shiftwidth,
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
