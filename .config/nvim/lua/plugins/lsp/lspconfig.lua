local lsp_servers = {
  "html",
  "nushell",
  "emmet_language_server",
  "cssmodules_ls",
  "css_variables",
  "ts_ls",
  -- "pylyzer",
}

-- local disabled_lsp_servers = {
--   "vtsls",
--   "pyright",
--   "basedpyright",
--   "tsserver",
-- }

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

    servers[name] = vim.tbl_deep_extend("force", servers[name] or {}, settings, {
      on_init = function(client)
        client.offset_encoding = "utf-8"
      end,
    })
  end

  -- for _, name in ipairs(disabled_lsp_servers) do
  --   servers[name] = nil
  -- end

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
    local opt = {
      diagnostics = {
        underline = false,
        virtual_lines = false,
        virtual_text = { spacing = 0 },
        float = {
          focusable = true,
          style = "minimal",
          border = "rounded",
          source = "always",
        },
        signs = false,
      },
    }

    return vim.tbl_deep_extend("force", opts, opt)
  end,
}
