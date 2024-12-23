local ensure_installed = {
  "prettierd",
  "eslint_d",
  "shellcheck",
  "vale",
  "shfmt",
  "beautysh",
  "js-debug-adapter",
  "gitui",
}

if not LINUX then
  PUSH(ensure_installed, "stylua")
end

return {
  "williamboman/mason.nvim",
  opts = function()
    return {
      ensure_installed = ensure_installed,
    }
  end,
  keys = {
    {
      "<leader>gG",
      function()
        Snacks.terminal({ "gitui" })
      end,
      desc = "GitUi (cwd)",
    },
    {
      "<leader>gg",
      function()
        Snacks.terminal({ "gitui" }, { cwd = LazyVim.root.get() })
      end,
      desc = "GitUi (Root Dir)",
    },
  },
}
