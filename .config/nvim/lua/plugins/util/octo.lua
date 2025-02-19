return {
  "pwntester/octo.nvim",
  dependencies = { "Kaiser-Yang/blink-cmp-git" },
  cond = IS_LAUNCH_FROM_GIT_REPO,
  opts = function(_, opts)
    ADD_BLINK_SOURCE("git", { "octo", "gitcommit", "markdown" }, {
      module = "blink-cmp-git",
      name = "Git",
      opts = {},
    })

    language.register("markdown", "octo")
    assign(opts, {
      picker = "fzf-lua",
    })

    return opts
  end,
}
