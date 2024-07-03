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
  cond = not IS_VSCODE,
  keys = keys,
  opts = {
    performance_mode = not IS_MAC,
    mappings = keys,
  },
}
