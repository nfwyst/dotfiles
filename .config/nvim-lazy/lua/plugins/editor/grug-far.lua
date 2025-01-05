return {
  "MagicDuck/grug-far.nvim",
  opts = function(_, opts)
    -- show fold signs in searched view
    AUCMD("FileType", {
      group = GROUP("show_grug_far_fold", { clear = true }),
      pattern = "grug-far",
      callback = function(event)
        defer(function()
          local win = fn.bufwinid(event.buf)
          local win_opts = COLUMN_OPTS(false)
          win_opts.foldcolumn = "2"
          SET_OPTS(win_opts, wo[win])
        end, 30)
      end,
    })

    local opt = {
      minSearchChars = 3,
      maxWorkers = LINUX and 2 or nil,
      reportDuration = false,
      maxSearchMatches = LINUX and 1000 or nil,
      normalModeSearch = true,
      engines = {
        ripgrep = {
          extraArgs = "--no-ignore --hidden --glob !node_modules",
        },
      },
    }

    return merge(opts, opt)
  end,
}
