local ensure_installed = {
  "prettierd",
  "eslint_d",
  "shellcheck",
  "vale",
  "shfmt",
  "beautysh",
  "js-debug-adapter",
  "stylua",
}

return {
  "williamboman/mason.nvim",
  opts = {
    ensure_installed = ensure_installed,
  },
}
