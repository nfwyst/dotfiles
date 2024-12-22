return {
  "nvim-treesitter/nvim-treesitter",
  init = function()
    vim.filetype.add({
      filename = {
        ["vifmrc"] = "vim",
      },
      pattern = {
        [".*/waybar/config"] = "jsonc",
        ["%.env%.[%w_.-]+"] = "sh",
      },
    })
    language.register("bash", "zsh")
  end,
  opts = {
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
  },
}
