return {
  "pwntester/octo.nvim",
  dependencies = { "Kaiser-Yang/blink-cmp-git" },
  cond = IS_LAUNCH_FROM_GIT_REPO,
  opts = function(_, opts)
    ADD_BLINK_SOURCE({
      id = "git",
      filetypes = { "octo", "gitcommit", "markdown" },
      config = {
        name = "Git",
        module = "blink-cmp-git",
      },
    })

    language.register("markdown", "octo")
    assign(opts, {
      picker = "fzf-lua",
    })

    return opts
  end,
}
