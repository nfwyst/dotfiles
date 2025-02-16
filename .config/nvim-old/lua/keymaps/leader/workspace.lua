local function open_grug_far()
  require('grug-far').open()
end

return {
  ['<leader>W'] = { group = 'Workspace' },
  ['<leader>Wf'] = {
    open_grug_far,
    desc = 'Search and replace',
  },
  ['<leader>WS'] = { '<cmd>wa!<cr>', desc = 'Save all content' },
  ['<leader>Wd'] = {
    function()
      require('telescope.builtin').diagnostics({ root_dir = GET_GIT_ROOT() })
    end,
    desc = 'Workspace Diagnostics',
  },
  ['<leader>Ws'] = { '<cmd>WorkspaceSymbols<cr>', desc = 'Workspace Symbols' },
}
