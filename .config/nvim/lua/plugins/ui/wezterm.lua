return {
  'willothy/wezterm.nvim',
  cond = IS_MAC,
  lazy = true,
  opts = {
    create_commands = false,
  },
  config = true,
}
