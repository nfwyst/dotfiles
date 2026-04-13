-- Native LSP configuration (Neovim 0.12+)
-- Replaces nvim-lspconfig with vim.lsp.config() + vim.lsp.enable()

local ts_util = require("config.ts_util")

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
    workspace = {
      fileOperations = {
        didRename = true,
        willRename = true,
      },
    },
  },
  on_attach = function(client)
    client.server_capabilities.semanticTokensProvider = nil
  end,
})

vim.lsp.log.set_level(vim.log.levels.OFF)

-- ===================================================================
-- Conditional TS server selection: tsgo for non-Vue, vtsls for Vue
-- ===================================================================
-- Both tsgo and vtsls are enabled globally; the guard below detects the
-- project type on LspAttach and detaches the wrong server immediately.
-- tsgo is preferred (faster, Go-native); vtsls activates only in Vue
-- projects where @vue/typescript-plugin is required.
-- ===================================================================

local ts_server_for_root = {} -- cache: root_dir → "tsgo" | "vtsls"

--- Determine which TS server should own a given root directory.
--- @param root string|nil
--- @return "tsgo"|"vtsls"
local function pick_ts_server(root)
  if not root then
    return "tsgo"
  end
  if ts_server_for_root[root] ~= nil then
    return ts_server_for_root[root]
  end
  -- Deno projects: neither tsgo nor vtsls should attach,
  -- but for selection purposes default to tsgo (will be blocked by Deno LSP)
  if ts_util.is_deno_project(root) then
    ts_server_for_root[root] = "tsgo"
    return "tsgo"
  end
  local server = ts_util.is_vue_project(root) and "vtsls" or "tsgo"
  ts_server_for_root[root] = server
  return server
end

-- Attach guard: prevent the wrong TS server from attaching
vim.api.nvim_create_autocmd("LspAttach", {
  group = vim.api.nvim_create_augroup("ts_server_guard", { clear = true }),
  callback = function(event)
    local client = vim.lsp.get_client_by_id(event.data.client_id)
    if not client then
      return
    end
    local name = client.name
    if name ~= "tsgo" and name ~= "vtsls" then
      return -- not a TS server, ignore
    end
    local root = client.root_dir
    local wanted = pick_ts_server(root)
    if name ~= wanted then
      -- Wrong server for this project; detach and stop it
      vim.lsp.buf_detach_client(event.buf, client.id)
      vim.defer_fn(function()
        client:stop()
      end, 100)
    end
  end,
})

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

-- Auto-enable inlay hints for supported servers
vim.api.nvim_create_autocmd("LspAttach", {
  group = vim.api.nvim_create_augroup("lsp_inlay_hints", { clear = true }),
  callback = function(event)
    local client = vim.lsp.get_client_by_id(event.data.client_id)
    if client and client:supports_method("textDocument/inlayHint") then
      local bufnr = event.buf
      if vim.api.nvim_buf_is_valid(bufnr) and vim.bo[bufnr].buftype == "" then
        vim.lsp.inlay_hint.enable(true, { bufnr = bufnr })
      end
    end
  end,
})
