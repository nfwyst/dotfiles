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
  "protols",
  -- "pylyzer",
}

local disabled_lsp_servers = {
  "tsserver",
  --   "pyright",
  --   "basedpyright",
}

local function override(servers)
  local windows = require("lspconfig.ui.windows")

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

  local keys = servers["*"].keys

  for _, key in ipairs(keys) do
    key.has = nil
  end

  vim.list_extend(keys, {
    { "ga", "", desc = "callHierarchy" },
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

vim.lsp.log.set_level(vim.log.levels.OFF)

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
      servers = {
        tsgo = { enabled = false },
        ts_ls = { enabled = true },
        ["*"] = {
          capabilities = { offset_encoding = "utf-16" },
          on_exit = function(code, _, client_id)
            if code == 0 then
              return
            end
            local client = vim.lsp.get_client_by_id(client_id)
            local server_name = client and client.name or "unknow"
            vim.schedule(function()
              vim.cmd.LspRestart({ bang = true })
              vim.notify(server_name .. " exited abnormal. Lsp server" .. " restarted")
            end)
          end,
        },
      },
    }

    return vim.tbl_deep_extend("force", opts, opt)
  end,
}
