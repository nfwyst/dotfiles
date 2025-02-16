return {
  "karb94/neoscroll.nvim",
  cond = ENABLE_SCROLL_EFFECT,
  event = { "BufReadPost", "BufNewFile" },
  opts = {
    performance_mode = IS_LINUX,
    mappings = {
      "<C-u>",
      "<C-d>",
      "<C-b>",
      "<C-f>",
      "<C-y>",
      "<C-e>",
      "zt",
      "zz",
      "zb",
    },
  },
}
