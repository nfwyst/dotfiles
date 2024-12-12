local st = vim.diagnostic.severity

local function setup_diagnostic()
  local config = {
    virtual_text = false,
    signs = {
      text = {
        [st.ERROR] = ' ',
        [st.WARN] = ' ',
        [st.HINT] = ' ',
        [st.INFO] = ' ',
      },
    },
    update_in_insert = false,
    underline = false,
    severity_sort = true,
    float = {
      focusable = false,
      style = 'minimal',
      border = 'rounded',
      source = 'always',
    },
  }
  vim.diagnostic.config(config)
end

local function init()
  setup_diagnostic()
  local lsp = vim.lsp
  local methods = lsp.protocol.Methods
  local hd = lsp.handlers
  local opt = {
    border = 'rounded',
    width = 'auto',
    max_width = GET_MAX_WIDTH(),
    silent = true,
  }
  hd[methods.textDocument_hover] = lsp.with(hd.hover, opt)
  hd[methods.textDocument_signatureHelp] = lsp.with(hd.signature_help, opt)
end

local function get_options(cmp_nvim_lsp, server)
  local opts = {
    capabilities = cmp_nvim_lsp.default_capabilities(),
  }
  local ok, setting = pcall(require, 'plugins.lsp.settings.' .. server)
  if not ok then
    return opts
  end
  if setting.disabled then
    return nil
  end
  return MERGE_TABLE(opts, setting)
end

local function try_load(server, opts)
  local original_try_add = server.manager.try_add
  local exclude = opts.exclude_filetypes
  local include = opts.include_filetypes
  server.manager.try_add = function(...)
    local filetype = GET_FILETYPE(GET_CURRENT_BUFFER())
    local disabled = exclude and INCLUDES(exclude, filetype)
    local not_enabled = include and not INCLUDES(include, filetype)
    if disabled or not_enabled then
      return
    end
    return original_try_add(...)
  end
end

return {
  'neovim/nvim-lspconfig',
  event = { 'BufReadPre', 'BufNewFile' },
  dependencies = {
    'hrsh7th/cmp-nvim-lsp',
    'b0o/schemastore.nvim',
  },
  config = function()
    require('lspconfig.ui.windows').default_options.border = 'rounded'
    local lspconfig = require('lspconfig')
    local cmp_nvim_lsp = require('cmp_nvim_lsp')
    ADD_CMP_SOURCE('nvim_lsp', { priority = 6 })

    for _, name in pairs(MERGE_ARRAYS(LSP_SERVERS, { 'nushell' })) do
      if name ~= 'ts_ls' then
        local server = lspconfig[name]
        local opts = get_options(cmp_nvim_lsp, name)
        if opts then
          server.setup(opts)
          try_load(server, opts)
        end
      end
    end

    init()
  end,
}
