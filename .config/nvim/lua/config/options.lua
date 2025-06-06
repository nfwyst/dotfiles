SET_OPTS({
  lazyvim_blink_main = true,
  snacks_animate = true,
  ai_cmp = false,
  editorconfig = true,
  lazyvim_picker = "fzf",
  transparent_enabled = true,
  autoformat = true,
  statuscolumn = o.statuscolumn,
}, "g")

SET_OPTS({
  number = ENABLE_NUMBER,
  relativenumber = ENABLE_NUMBER,
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
  showcmd = false,
  breakindent = true,
  modeline = false,
  guicursor = function(cursor)
    cursor:remove("t:block-blinkon500-blinkoff500-TermCursor")
    cursor:append("a:Cursor/lCursor")

    return o.guicursor
  end,
})
