return {
  "willothy/wezterm.nvim",
  cond = not IS_VSCODE_OR_LEET_CODE and not IS_WIN_LINUX,
  lazy = true,
  opts = {
    create_commands = false,
  },
  config = true,
}
