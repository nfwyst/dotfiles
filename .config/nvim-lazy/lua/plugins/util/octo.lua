return {
  "pwntester/octo.nvim",
  cond = IS_LAUNCH_FROM_GIT_REPO,
  opts = function(_, opts)
    language.register("markdown", "octo")
    assign(opts, {
      picker = "fzf-lua",
    })
    return opts
  end,
}
