return {
  "arnamak/stay-centered.nvim",
  cond = function()
    return not g.snacks_scroll
  end,
  lazy = false,
  name = "stay-centered",
  priority = 1000,
  opts = {
    enabled = true,
    skip_filetypes = {
      "Trouble",
      "alpha",
      "dashboard",
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
