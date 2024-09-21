return {
  "sindrets/diffview.nvim",
  cmd = {
    "DiffviewOpen",
    "DiffviewClose",
    "DiffviewToggleFiles",
    "DiffviewFocusFiles",
    "DiffviewRefresh",
    "DiffviewFileHistory",
  },
  config = function()
    require("diffview").setup({
      hooks = {
        diff_buf_read = function(bufnr)
          SET_OPTS({
            number = false,
            relativenumber = false,
            statuscolumn = "",
            foldcolumn = "2",
          }, { buf = bufnr })
        end,
      },
    })
  end,
}
