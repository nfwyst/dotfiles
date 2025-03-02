local dir = "/Applications/Ghostty.app/Contents/Resources/vim/vimfiles"

return {
  "ghostty",
  lazy = false,
  cond = not IS_LINUX and IS_DIRPATH(dir),
  dir = dir,
}
