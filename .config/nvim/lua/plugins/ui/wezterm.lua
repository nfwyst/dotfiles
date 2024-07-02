return {
  "willothy/wezterm.nvim",
  cond = not IS_VSCODE_OR_LEET_CODE,
  lazy = true,
  opts = {
    create_commands = false,
  },
  config = true,
}
