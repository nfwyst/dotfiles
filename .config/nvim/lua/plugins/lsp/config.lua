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
  local has_custom_opts, server_custom_opts =
    pcall(require, 'plugins.lsp.settings.' .. server)
  if has_custom_opts then
    if server_custom_opts.disabled then
      return nil
    end
    opts = MERGE_TABLE(opts, server_custom_opts)
  end
  return opts
end

local function try_load(conf, opts)
  local original_try_add = conf.manager.try_add
  local exclude = opts.exclude_filetypes
  local include = opts.include_filetypes
  local filetype = GET_FILETYPE(GET_CURRENT_BUFFER())
  conf.manager.try_add = function(config)
    local disabled = exclude and INCLUDES(exclude, filetype)
    local not_enabled = include and not INCLUDES(include, filetype)
    if disabled or not_enabled then
      return
    end
    return original_try_add(config)
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

    for _, server in pairs(MERGE_ARRAYS(LSP_SERVERS, { 'nushell' })) do
      if server ~= 'ts_ls' then
        local conf = lspconfig[server]
        local opts = get_options(cmp_nvim_lsp, server)
        if opts then
          conf.setup(opts)
          try_load(conf, opts)
        end
      end
    end

    init()
  end,
}
