local my_feature = {
  name = 'my_feature',
  opts = {
    defer = true,
  },
  disable = function()
    RUN_CMD('ColorizerDetachFromBuffer', true)
    RUN_CMD('UfoDetach', true)
  end,
}

local white_table = {
  help = true,
  text = true,
  markdown = true,
  Avante = true,
}

return {
  'lunarvim/bigfile.nvim',
  event = { 'FileReadPre', 'BufReadPre', 'User FileOpened' },
  config = function()
    require('bigfile').setup({
      pattern = function(bufnr)
        local filetype = GET_FILETYPE(bufnr)
        if white_table[filetype] then
          return false
        end
        return IS_BIG_FILE(bufnr)
      end,
      features = {
        'indent_blankline',
        'illuminate',
        'lsp',
        'syntax',
        'matchparen',
        'vimopts',
        'filetype',
        my_feature,
      },
    })
  end,
}
