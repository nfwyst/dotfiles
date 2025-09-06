local eslintd = { "eslint_d" }

vim.env.ESLINT_D_PPID = vim.fn.getpid()

return {
  "mfussenegger/nvim-lint",
  opts = {
    events = { "BufWritePost" },
    linters_by_ft = {
      javascript = eslintd,
      typescript = eslintd,
      typescriptreact = eslintd,
      javascriptreact = eslintd,
      svelte = eslintd,
      sh = { "bash" },
      zsh = { "zsh" },
      markdown = { "vale" },
    },
  },
}
