SET_OPTS({
  lazyvim_blink_main = true,
  snacks_animate = not IS_LINUX,
  ai_cmp = false,
  editorconfig = true,
  lazyvim_picker = "fzf",
  transparent_enabled = true,
}, "g")

SET_OPTS({
  relativenumber = not IS_LINUX,
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
  spelllang = "en,cjk",
  foldnestmax = 10,
  listchars = "tab:▓░,trail:•,extends:»,precedes:«,nbsp:░",
  undolevels = IS_LINUX and 1000 or 100000,
  showcmd = false,
  breakindent = true,
  background = "dark",
  guicursor = function(guicursor)
    return guicursor .. ",a:Cursor/lCursor"
  end,
})
