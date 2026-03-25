-- Native LSP configuration (Neovim 0.12+)
-- Replaces nvim-lspconfig with vim.lsp.config() + vim.lsp.enable()

-- Ensure mason bin is in PATH
local mason_bin = vim.fn.stdpath("data") .. "/mason/bin"
if not vim.env.PATH:find(mason_bin, 1, true) then
  vim.env.PATH = mason_bin .. ":" .. vim.env.PATH
end

-- Diagnostics configuration
vim.diagnostic.config({
  underline = false,
  virtual_lines = false,
  virtual_text = { spacing = 0, current_line = true },
  float = {
    focusable = true,
    style = "minimal",
    border = "rounded",
    source = true,
  },
  signs = {
    text = {
      [vim.diagnostic.severity.ERROR] = "",
      [vim.diagnostic.severity.WARN] = "",
      [vim.diagnostic.severity.INFO] = "",
      [vim.diagnostic.severity.HINT] = "󰌶",
    },
  },
})

-- Track client names for clean exit notifications
local client_names = {}

-- Global LSP settings for all servers
vim.lsp.config("*", {
  capabilities = { offsetEncoding = "utf-16" },
  on_attach = function(client)
    client.server_capabilities.semanticTokensProvider = nil
    client_names[client.id] = client.name
  end,
  on_exit = vim.schedule_wrap(function(code, signal, client_id)
    local name = client_names[client_id] or "unknown"
    client_names[client_id] = nil
    if code ~= 0 and signal ~= 15 then
      vim.notify(
        string.format("LSP [%s] crashed (exit code %d, signal %d)", name, code, signal),
        vim.log.levels.WARN
      )
    end
  end),
})

vim.lsp.log.set_level(vim.log.levels.OFF)

-- Enable all configured LSP servers
-- Server configs are in lsp/*.lua files (native 0.12 convention)
vim.lsp.enable({
  "lua_ls",
  "vtsls",
  "html",
  "cssls",
  "css_variables",
  "cssmodules_ls",
  "emmet_language_server",
  "tailwindcss",
  "taplo",
  "solc",
  "protols",
  "docker_language_server",
})
