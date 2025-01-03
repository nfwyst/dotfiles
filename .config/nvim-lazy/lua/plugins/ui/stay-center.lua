return {
  "arnamak/stay-centered.nvim",
  cond = function()
    return not g.snacks_scroll and not LINUX
  end,
  lazy = false,
  name = "stay-centered",
  priority = 1000,
  opts = {
    enabled = true,
    skip_filetypes = {
      "Trouble",
      "help",
      "lazy",
      "mason",
      "neo-tree",
      "notify",
      "snacks_dashboard",
      "snacks_notif",
      "snacks_terminal",
      "snacks_win",
      "toggleterm",
      "trouble",
    },
    allow_scroll_move = true,
    disable_on_mouse = false,
  },
}
