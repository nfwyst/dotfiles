return {
  "mason-org/mason.nvim",
  opts = function(_, opts)
    local ensure_installed = {
      "ast-grep",
      "tectonic",
      "tree-sitter-cli",
      "eslint_d",
      "beautysh",
      "prettierd",
      "vale",
      "kulala-fmt",
      "mmdc",
      "nginx-config-formatter",
      "uv",
      -- "delve",
    }

    for _, name in ipairs(opts.ensure_installed) do
      if name ~= "hadolint" and not vim.tbl_contains(ensure_installed, name) then
        ensure_installed[#ensure_installed + 1] = name
      end
    end

    local opt = {
      log_level = vim.log.levels.OFF,
      ensure_installed = ensure_installed,
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

    return vim.tbl_deep_extend("force", opts, opt)
  end,
}
