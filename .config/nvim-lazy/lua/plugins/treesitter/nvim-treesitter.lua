return {
  "nvim-treesitter/nvim-treesitter",
  opts = function(_, opts)
    language.register("bash", "zsh")
    local opt = {
      ensure_installed = {
        "css",
        "scss",
        "go",
        "svelte",
        "latex",
        "bash",
        "diff",
        "html",
        "javascript",
        "jsdoc",
        "json",
        "jsonc",
        "json5",
        "lua",
        "luadoc",
        "luap",
        "markdown",
        "markdown_inline",
        "printf",
        "python",
        "query",
        "regex",
        "toml",
        "tsx",
        "typescript",
        "vim",
        "vimdoc",
        "xml",
        "yaml",
        "git_config",
      },
      ignore_install = LINUX and { "nu" },
    }

    return merge(opts, opt)
  end,
}
