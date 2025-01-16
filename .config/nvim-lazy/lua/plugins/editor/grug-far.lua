return {
  "MagicDuck/grug-far.nvim",
  opts = function(_, opts)
    -- only show fold signs in searched view
    if not FILETYPE_TASK_MAP["grug-far"] then
      FILETYPE_TASK_MAP["grug-far"] = function(_, win)
        if WIN_VAR(win, TASK_KEY) then
          return
        end
        defer(function()
          local win_opts = COLUMN_OPTS(false)
          win_opts.foldcolumn = "2"
          SET_OPTS(win_opts, wo[win])
          WIN_VAR(win, TASK_KEY, true)
        end, 30)
      end
    end

    local opt = {
      minSearchChars = 3,
      maxWorkers = IS_LINUX and 2 or nil,
      reportDuration = false,
      maxSearchMatches = IS_LINUX and 1000 or nil,
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
