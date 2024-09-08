local keys = {
  "<C-u>",
  "<C-d>",
  "<C-y>",
  "<C-e>",
  "zt",
  "zz",
  "zb",
}

return {
  "karb94/neoscroll.nvim",
  keys = keys,
  opts = {
    performance_mode = true,
    mappings = keys,
  },
}
