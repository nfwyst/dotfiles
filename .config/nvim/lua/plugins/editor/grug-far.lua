return {
  "MagicDuck/grug-far.nvim",
  opts = function(_, opts)
    language.register("markdown", "grug-far-help")
    -- only show fold signs in searched view
    if not FILETYPE_TASK_MAP["grug-far"] then
      FILETYPE_TASK_MAP["grug-far"] = function(_, win)
        if WIN_VAR(win, FILETYPE_TASK_KEY) then
          return
        end
        defer(function()
          local win_opts = COLUMN_OPTS(false)
          win_opts.foldcolumn = "2"
          SET_OPTS(win_opts, { win = win })
          WIN_VAR(win, FILETYPE_TASK_KEY, true)
        end, 30)
      end
    end

    local opt = {
      minSearchChars = 3,
      maxWorkers = 4,
      reportDuration = false,
      maxSearchMatches = 2000,
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
