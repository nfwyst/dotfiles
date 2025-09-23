local util = require("config.util")
local lsp_servers = {
  "html",
  "emmet_language_server",
  "cssmodules_ls",
  "css_variables",
  "ts_ls",
  "cssls",
  "nginx_language_server",
  "solc",
  "vtsls",
  -- "pylyzer",
}

local disabled_lsp_servers = {
  "tsserver",
  --   "pyright",
  --   "basedpyright",
}

local function override(servers)
  local windows = require("lspconfig.ui.windows")
  local keys = require("lazyvim.plugins.lsp.keymaps").get()

  windows.default_options.border = "rounded"

  for _, name in ipairs(lsp_servers) do
    local path = "plugins.lsp.settings." .. name
    local ok, settings = pcall(require, path)
    if not ok or not settings then
      settings = {}
    end

    servers[name] = vim.tbl_deep_extend("force", servers[name] or {}, settings)
  end

  for _, name in ipairs(disabled_lsp_servers) do
    servers[name] = nil
  end

  vim.list_extend(keys, {
    { "K", false },
    { "<c-k>", false, mode = "i" },
    {
      "gk",
      function()
        return vim.lsp.buf.hover()
      end,
      desc = "Hover",
    },
  })
end

vim.lsp.set_log_level(vim.log.levels.OFF)

return {
  "neovim/nvim-lspconfig",
  opts = function(_, opts)
    override(opts.servers)
    util.set_hl("LspInlayHint gui=italic")

    local opt = {
      diagnostics = {
        underline = false,
        virtual_lines = false,
        virtual_text = { spacing = 0, current_line = true },
        float = {
          focusable = true,
          style = "minimal",
          border = "rounded",
          source = "always",
        },
        signs = {
          text = {
            [vim.diagnostic.severity.ERROR] = "",
            [vim.diagnostic.severity.WARN] = "",
            [vim.diagnostic.severity.INFO] = "",
            [vim.diagnostic.severity.HINT] = "󰌶",
          },
        },
      },
      inlay_hints = { enabled = true },
      capabilities = {
        offset_encoding = "utf-16",
      },
    }

    return vim.tbl_deep_extend("force", opts, opt)
  end,
}
