return {
  ['<leader>l'] = { group = 'LSP/Learn' },
  ['<leader>ls'] = { group = 'LSP' },
  ['<leader>lsD'] = {
    DISABLE_DIAGNOSTIC,
    desc = 'Disable Diagnostic Globally',
  },
  ['<leader>lsE'] = {
    ENABLE_DIAGNOSTIC,
    desc = 'Enable Diagnostic Globally',
  },
  ['<leader>lsI'] = { '<cmd>LspInfo<cr>', desc = 'LSP information' },
  ['<leader>lsQ'] = {
    '<cmd>lua vim.diagnostic.setqflist()<cr>',
    desc = 'All Quickfix',
  },
  ['<leader>lsc'] = { '<cmd>ConformInfo<cr>', desc = 'Show formatter info' },
  ['<leader>lsd'] = {
    '<cmd>Telescope diagnostics bufnr=0<cr>',
    desc = 'Document Diagnostics',
  },
  ['<leader>lse'] = {
    function()
      ENABLE_DIAGNOSTIC(GET_CURRENT_BUFFER())
    end,
    desc = 'Enable Diagnostic Locally',
  },
  ['<leader>lsf'] = { '<cmd>Format<cr>', desc = 'Format' },
  ['<leader>lsF'] = { '<cmd>FixAll<cr>', desc = 'Fix all' },
  ['<leader>lsi'] = { '<cmd>LspInfo<cr>', desc = 'Info' },
  ['<leader>lsl'] = {
    '<cmd>lua vim.lsp.codelens.run()<cr>',
    desc = 'CodeLens Action',
  },
  ['<leader>lsq'] = {
    '<cmd>lua vim.diagnostic.setloclist()<cr>',
    desc = 'Quickfix',
  },
  ['<leader>lss'] = { '<cmd>DocumentSymbols<cr>', desc = 'Document Symbols' },
  ['<leader>le'] = { group = 'Learn' },
  ['<leader>lea'] = { '<cmd>Leet random<cr>', desc = 'Random' },
  ['<leader>lec'] = { '<cmd>Leet console<cr>', desc = 'Console' },
  ['<leader>led'] = { '<cmd>Leet desc<cr>', desc = 'Description' },
  ['<leader>leh'] = { '<cmd>Leet hints<cr>', desc = 'Hints' },
  ['<leader>lei'] = { '<cmd>Leet info<cr>', desc = 'Info' },
  ['<leader>lel'] = { '<cmd>Leet lang<cr>', desc = 'Language' },
  ['<leader>lem'] = { '<cmd>Leet<cr>', desc = 'Menu' },
  ['<leader>leq'] = { '<cmd>Leet tabs<cr>', desc = 'Tabs' },
  ['<leader>ler'] = { '<cmd>Leet run<cr>', desc = 'Run' },
  ['<leader>les'] = { '<cmd>Leet submit<cr>', desc = 'Submit' },
  ['<leader>let'] = { '<cmd>Leet list<cr>', desc = 'List' },
  ['<leader>ley'] = { '<cmd>Leet daily<cr>', desc = 'Daily' },
}
