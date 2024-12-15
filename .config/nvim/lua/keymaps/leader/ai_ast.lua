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
  ['<leader>ait'] = {
    '<cmd>MinuetToggleVirtualText<cr>',
    desc = 'Toggle ai virtual text completion',
  },
  ['<leader>aiaa'] = {
    run_avante('avante.api', 'ask'),
    desc = 'avante: ask',
  },
  ['<leader>aiae'] = {
    run_avante('avante.api', 'edit'),
    desc = 'avante: edit',
  },
  ['<leader>aiar'] = {
    run_avante('avante.api', 'refresh'),
    desc = 'avante: refresh',
  },
  ['<leader>aiat'] = {
    run_avante('avante', 'toggle'),
    desc = 'avante: toggle',
  },
  ['<leader>aiah'] = {
    run_avante('avante', 'toggle', 'hint'),
    desc = 'avante: toggle hint',
  },
  ['<leader>aiad'] = {
    run_avante('avante', 'toggle', 'debug'),
    desc = 'avante: toggle debug',
  },
  ['<leader>aias'] = {
    run_avante('avante', 'toggle', 'suggestion'),
    desc = 'avante: toggle suggestion',
  },
  ['<leader>aiaR'] = {
    run_avante('avante.repo_map', 'show'),
    desc = 'avante: show repo map',
  },
  ['<leader>aiaT'] = { '<cmd>TogglePrompt<cr>', desc = 'Toggle system prompt' },
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
