local to_install = {
  "prettierd",
  "shellcheck",
  "vale",
  "shfmt",
  "beautysh",
  "js-debug-adapter",
  "gitui",
  "markdown-toc",
  "markdownlint-cli2",
  "ast-grep",
}

local ensure_installed = {}
for _, name in ipairs(to_install) do
  if not executable(name) then
    PUSH(ensure_installed, name)
  end
end

local function get_gitui_theme()
  if o.background == "light" then
    return "latte.ron"
  end

  return "frappe.ron"
end

local function open_gitui(is_root)
  local opt
  if is_root then
    opt = { cwd = LazyVim.root.get() }
  end

  Snacks.terminal({ "gitui", "-t", get_gitui_theme() }, opt)
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

    return merge(opts, opt)
  end,
  keys = {
    { "<leader>gG", open_gitui, desc = "GitUi (cwd)" },
    {
      "<leader>gg",
      function()
        open_gitui(true)
      end,
      desc = "GitUi (Root Dir)",
    },
  },
}
