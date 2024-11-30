return {
  'williamboman/mason.nvim',
  dependencies = {
    'williamboman/mason-lspconfig.nvim',
    'WhoIsSethDaniel/mason-tool-installer.nvim',
  },
  config = function()
    require('mason').setup({
      log_level = vim.log.levels.OFF,
      ui = {
        border = 'rounded',
        height = 0.7,
        icons = {
          package_installed = '✓',
          package_pending = '◍',
          package_uninstalled = '✗',
        },
      },
    })

    require('mason-lspconfig').setup({
      ensure_installed = LSP_SERVERS,
      automatic_installation = true,
    })

    local other = {
      'prettierd',
      'eslint_d',
      'shellcheck',
      'vale',
      'shfmt',
      'beautysh',
      'js-debug-adapter',
    }

    if IS_MAC then
      table.insert(other, 'stylua')
    end

    require('mason-tool-installer').setup({
      ensure_installed = other,
    })
  end,
}
