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
  severity_sort = true,
  signs = {
    text = {
      [vim.diagnostic.severity.ERROR] = "",
      [vim.diagnostic.severity.WARN] = "",
      [vim.diagnostic.severity.INFO] = "",
      [vim.diagnostic.severity.HINT] = "󰌶",
    },
  },
})

-- Global LSP settings for all servers
vim.lsp.config("*", {
  capabilities = {
    general = {
      positionEncodings = { "utf-16" },
    },
    workspace = {
      fileOperations = {
        didRename = true,
        willRename = true,
      },
    },
  },
  on_exit = function(code, signal, client_id)
    if code == 0 or signal == 15 then
      return
    end

    local client = vim.lsp.get_client_by_id(client_id)
    local server_name = client and client.name or "unknown"
    vim.schedule(function()
      vim.cmd("lsp restart")
      vim.notify(server_name .. " exited abnormal. LSP restarted", vim.log.levels.WARN)
    end)
  end,
  on_attach = function(client)
    client.server_capabilities.semanticTokensProvider = nil
  end,
})

vim.lsp.log.set_level(vim.log.levels.ERROR)

local default_log_message_handler = vim.lsp.handlers["window/logMessage"]
vim.lsp.handlers["window/logMessage"] = function(err, result, ctx, config)
  local client = ctx and ctx.client_id and vim.lsp.get_client_by_id(ctx.client_id)
  local message = result and result.message
  if client and client.name == "vtsls" and type(message) == "string" then
    if message == "Command setContext not found" then
      return
    end
    if message == "TSServer exited. Code: null. Signal: SIGTERM" then
      return
    end
  end
  return default_log_message_handler(err, result, ctx, config)
end

vim.lsp.commands["editor.action.showReferences"] = function(command, ctx)
  ---@type lsp.Location[]
  local locations = command.arguments[3]
  if not locations or #locations == 0 then
    vim.notify("No references found", vim.log.levels.INFO)
    return
  end
  local client = vim.lsp.get_client_by_id(ctx.client_id)
  if not client then
    return
  end
  local items = vim.lsp.util.locations_to_items(locations, client.offset_encoding)
  vim.fn.setqflist({}, " ", { title = "References", items = items })
  vim.cmd("Trouble qflist open")
end

-- ===================================================================
-- TS server selection: tsgo vs vtsls
-- ===================================================================
-- tsgo handles plain TS/JS/React by default.
-- vtsls is enabled only for Vue projects that need @vue/typescript-plugin.
-- Deno projects are skipped by both and handled by Deno LSP.
-- ===================================================================

-- Enable all configured LSP servers
-- Server configs are in lsp/*.lua files (native 0.12 convention)
vim.lsp.enable({
  "lua_ls",
  "tsgo",
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
  "jsonls",
  "yamlls",
  "vue_ls",
})
