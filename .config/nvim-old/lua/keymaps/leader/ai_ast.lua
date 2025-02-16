local run_avante = function(mod, name, subname)
  local avante
  return function()
    if not avante then
      avante = require(mod)
    end
    local fn = avante[name]
    if subname then
      fn = fn[subname]
    end
    fn()
  end
end

return {
  ['<leader>a'] = { group = 'AI/AST' },
  ['<leader>ai'] = { group = 'AI' },
  ['<leader>as'] = { group = 'AST' },
  ['<leader>aig'] = { group = 'GPT prompt' },
  ['<leader>aia'] = { group = 'Avante' },
  ['<leader>aiv'] = {
    '<cmd>MinuetToggleVirtualText<cr>',
    desc = 'Toggle AI Virtual Text Completion',
  },
  ['<leader>aic'] = {
    '<cmd>MinuetToggleCmp<cr>',
    desc = 'Toggle Cmp AI Completion',
  },
  ['<leader>aiaa'] = {
    run_avante('avante.api', 'ask'),
    desc = 'Avante: Ask',
  },
  ['<leader>aiae'] = {
    run_avante('avante.api', 'edit'),
    desc = 'Avante: Edit',
  },
  ['<leader>aiar'] = {
    run_avante('avante.api', 'refresh'),
    desc = 'Avante: Refresh',
  },
  ['<leader>aiat'] = {
    run_avante('avante', 'toggle'),
    desc = 'Avante: Toggle',
  },
  ['<leader>aiah'] = {
    run_avante('avante', 'toggle', 'hint'),
    desc = 'Avante: Toggle Hint',
  },
  ['<leader>aiad'] = {
    run_avante('avante', 'toggle', 'debug'),
    desc = 'Avante: Toggle Debug',
  },
  ['<leader>aias'] = {
    run_avante('avante', 'toggle', 'suggestion'),
    desc = 'Avante: Toggle Suggestion',
  },
  ['<leader>aiaR'] = {
    run_avante('avante.repo_map', 'show'),
    desc = 'Avante: Show Repo Map',
  },
  ['<leader>aiab'] = {
    desc = 'Avante: Add Current Buffer To Context',
  },
  ['<leader>aiaT'] = {
    '<cmd>TogglePrompt<cr>',
    desc = 'Avante: Toggle System Prompt',
  },
  ['<leader>aiay'] = {
    '<cmd>AvanteClear history<cr>',
    desc = 'Avante: Clear History',
  },
  ['<leader>aiam'] = {
    '<cmd>AvanteClear memory<cr>',
    desc = 'Avante: Clear Memory',
  },
  ['<leader>aiac'] = {
    '<cmd>AvanteClear cache<cr>',
    desc = 'Avante: Clear Cache',
  },
  ['<leader>aiaC'] = {
    function()
      vim.cmd.AvanteClear('history')
      vim.cmd.AvanteClear('memory')
      vim.cmd.AvanteClear('cache')
    end,
    desc = 'Avante: Clear All',
  },
  ['<leader>aigc'] = { '<cmd>GpPickCommand<cr>', desc = 'GPT select command' },
  ['<leader>aiga'] = { '<cmd>GpSelectAgent<cr>', desc = 'GPT select agent' },
  ['<leader>aigt'] = {
    function()
      vim.cmd('GpChatToggle')
      SET_GPT_SIDEBAR_WIDTH()
    end,
    desc = 'GPT toggle',
  },
  ['<leader>asc'] = { '<cmd>TSContextToggle<cr>', desc = 'Toggle code context' },
  ['<leader>ase'] = { '<cmd>EditQuery<cr>', desc = 'Show live query editor' },
  ['<leader>ash'] = {
    '<cmd>Inspect<cr>',
    desc = 'Highlight groups under the cursor',
  },
  ['<leader>ass'] = { '<cmd>TSUpdateSync<cr>', desc = 'Update language sync' },
  ['<leader>ast'] = { '<cmd>InspectTree<cr>', desc = 'Show syntax tree' },
  ['<leader>asu'] = { '<cmd>TSUpdate<cr>', desc = 'Update language' },
}
