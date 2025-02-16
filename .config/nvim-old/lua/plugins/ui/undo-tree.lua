return {
  'debugloop/telescope-undo.nvim',
  cmd = 'Telescope undo',
  dependencies = {
    'nvim-telescope/telescope.nvim',
  },
  config = function()
    require('telescope').load_extension('undo')
  end,
}
