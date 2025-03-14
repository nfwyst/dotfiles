return {
  'luukvbaal/statuscol.nvim',
  event = { 'BufReadPost', 'BufNewFile' },
  config = function()
    local statuscol = require('statuscol')
    local builtin = require('statuscol.builtin')
    statuscol.setup({
      relculright = true,
      foldfunc = 'builtin',
      setopt = true,
      ft_ignore = MERGE_ARRAYS(INVALID_FILETYPE, { 'git' }),
      segments = {
        {
          text = { builtin.foldfunc, ' ' },
          condition = {
            function()
              return IS_PACKAGE_LOADED('ufo')
            end,
          },
          click = 'v:lua.ScFa',
        },
        {
          sign = {
            namespace = { 'diagnostic/signs' },
            maxwidth = 1,
            auto = false,
          },
          click = 'v:lua.ScSa',
        },
        {
          sign = {
            name = { 'todo*' },
            maxwidth = 1,
            auto = true,
          },
          click = 'v:lua.ScSa',
        },
        {
          sign = {
            name = { 'test*' },
            maxwidth = 1,
            auto = true,
          },
          click = 'v:lua.ScSa',
        },
        {
          sign = {
            namespace = { 'markview*' },
            maxwidth = 1,
            auto = true,
          },
          click = 'v:lua.ScSa',
        },
        {
          text = { ' ', builtin.lnumfunc, ' ' },
          condition = { builtin.not_empty },
          click = 'v:lua.ScLa',
        },
        {
          sign = {
            namespace = { 'gitsigns' },
            maxwidth = 1,
            auto = true,
            wrap = true,
          },
          click = 'v:lua.ScSa',
        },
      },
    })
  end,
}
