return {
  'sindrets/diffview.nvim',
  cond = IS_GIT_REPO,
  cmd = {
    'DiffviewOpen',
    'DiffviewClose',
    'DiffviewToggleFiles',
    'DiffviewFocusFiles',
    'DiffviewRefresh',
    'DiffviewFileHistory',
  },
  config = function()
    require('diffview').setup({
      hooks = {
        diff_buf_read = function(bufnr)
          SET_OPTS({
            number = false,
            relativenumber = false,
            statuscolumn = '',
            foldcolumn = '2',
          }, { buf = bufnr })
        end,
      },
    })
  end,
}
