-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here
SET_OPTS({
  lazyvim_blink_main = true,
  snacks_animate = not LINUX,
  snacks_scroll = not LINUX,
  ai_cmp = false,
}, "g")

SET_OPTS({
  relativenumber = not LINUX,
})
