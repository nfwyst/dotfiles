return {
  "willothy/wezterm.nvim",
  cond = not LINUX,
  lazy = true,
  opts = {
    create_commands = false,
  },
}
