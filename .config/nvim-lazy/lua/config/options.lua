SET_OPTS({
  lazyvim_blink_main = true,
  snacks_animate = not LINUX,
  snacks_scroll = not LINUX,
  ai_cmp = false,
  editorconfig = true,
  lazyvim_picker = "fzf",
}, "g")

SET_OPTS({
  relativenumber = not LINUX,
  showtabline = 0,
  swapfile = false,
  timeoutlen = 350,
  updatetime = 250,
  writebackup = false,
  softtabstop = 2,
  numberwidth = 2,
  wrap = true,
  linebreak = false,
  redrawtime = 1500,
  spelllang = { "en", "cjk" },
  foldnestmax = 10,
  listchars = {
    tab = "▓░",
    trail = "•",
    extends = "»",
    precedes = "«",
    nbsp = "░",
  },
  undolevels = 1000,
  showcmd = false,
  breakindent = true,
})
