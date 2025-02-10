local ensure_installed = {
  "prettierd",
  "shellcheck",
  "vale",
  "shfmt",
  "beautysh",
  "js-debug-adapter",
  "gitui",
  "markdown-toc",
  "markdownlint-cli2",
}

if not IS_LINUX then
  PUSH(ensure_installed, "stylua")
end

return {
  "williamboman/mason.nvim",
  opts = function(_, opts)
    opts.ensure_installed = ensure_installed
    local opt = {
      log_level = levels.OFF,
      ui = {
        border = "rounded",
        height = 0.7,
        icons = {
          package_installed = "✓",
          package_pending = "◍",
          package_uninstalled = "✗",
        },
      },
    }

    schedule(function()
      local mr = require("mason-registry")
      local p = mr.get_package("eslint_d")
      if not p:is_installed() then
        cmd.MasonInstall("eslint_d@13.1.2")
      end
    end)

    return merge(opts, opt)
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
