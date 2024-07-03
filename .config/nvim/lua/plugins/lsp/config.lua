local st = vim.diagnostic.severity

local function setup_diagnostic()
  local config = {
    virtual_text = false,
    signs = {
      text = {
        [st.ERROR] = " ",
        [st.WARN] = " ",
        [st.HINT] = " ",
        [st.INFO] = " ",
      },
    },
    update_in_insert = true,
    underline = false,
    severity_sort = true,
    float = {
      focusable = false,
      style = "minimal",
      border = "rounded",
      source = "always",
      header = "",
      prefix = "",
    },
  }
  vim.diagnostic.config(config)
  if IS_LEET_CODE then
    vim.diagnostic.enable(false)
  end
end

local function filter_hints_result(result)
  return FILTER_TABLE(result, function(hint)
    local label = hint.label
    if not label then
      return false
    end
    local labels = ""
    for _, segment in pairs(label) do
      labels = labels .. segment.value
    end
    if labels:len() >= 40 then
      return false
    end
    return true
  end)
end

local function init()
  setup_diagnostic()
  local lsp = vim.lsp
  local methods = lsp.protocol.Methods
  local hd = lsp.handlers
  local opt = {
    border = "rounded",
    width = LSP_DOC_WIDTH,
    max_width = GET_MAX_WIDTH(),
    silent = true,
  }
  hd[methods.textDocument_hover] = lsp.with(hd.hover, opt)
  hd[methods.textDocument_signatureHelp] = lsp.with(hd.signature_help, opt)
  -- Workaround for hide long TypeScript inlay hints.
  local method = methods.textDocument_inlayHint
  local inlay_hint_handler = hd[method]
  hd[method] = function(err, result, ctx, config)
    local client = lsp.get_client_by_id(ctx.client_id)
    if client and client.name == "tsserver" and result then
      result = filter_hints_result(result)
    end
    inlay_hint_handler(err, result, ctx, config)
  end
  -- FIXME: wait for tsserver fix hint issue
  -- FIXME replace tsserver with typeScript-tools
  -- TOGGLE_INLAY_HINT()
end

local function on_attach(client)
  if client.name == "tsserver" then
    client.server_capabilities.documentFormattingProvider = false
    client.server_capabilities.documentRangeFormattingProvider = false
  end
end

local function get_options(cmp_nvim_lsp, server)
  local opts = {
    on_attach = on_attach,
    capabilities = cmp_nvim_lsp.default_capabilities(),
  }
  local has_custom_opts, server_custom_opts =
    pcall(require, "plugins.lsp.settings." .. server)
  if has_custom_opts then
    if server_custom_opts.disabled then
      return nil
    end
    opts = MERGE_TABLE(opts, server_custom_opts)
  end
  return opts
end

local function try_load(conf, exclude_filetypes, include_filetypes)
  local try_add = conf.manager.try_add
  conf.manager.try_add = function(config)
    local disabled = TABLE_CONTAINS(exclude_filetypes, vim.bo.filetype)
    if disabled then
      return
    end
    if include_filetypes ~= nil then
      local enabled = TABLE_CONTAINS(include_filetypes, vim.bo.filetype)
      if not enabled then
        return
      end
    end
    return try_add(config)
  end
end

local function load_neodev(server)
  if not IS_MAC or server ~= "lua_ls" then
    return
  end
  if IS_LEET_CODE then
    return
  end
  require("neodev").setup()
end

return {
  "neovim/nvim-lspconfig",
  cond = not IS_VSCODE,
  event = { "BufReadPre", "BufNewFile" },
  dependencies = {
    "hrsh7th/cmp-nvim-lsp",
    "b0o/schemastore.nvim",
  },
  config = function()
    require("lspconfig.ui.windows").default_options.border = "rounded"
    local lspconfig = require("lspconfig")
    local cmp_nvim_lsp = require("cmp_nvim_lsp")

    for _, server in pairs(MERGE_ARRAYS(LSP_SERVERS, { "nushell" })) do
      local conf = lspconfig[server]
      local opts = get_options(cmp_nvim_lsp, server)
      if not opts then
        goto continue
      end
      load_neodev(server)
      conf.setup(opts)
      try_load(conf, opts.exclude_filetypes or {}, opts.include_filetypes)
      ::continue::
    end

    init()
  end,
}
