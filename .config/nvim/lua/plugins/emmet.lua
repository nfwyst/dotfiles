return {
  'mattn/emmet-vim',
  cmd = 'EmmetInstall',
  config = function()
    SET_GLOBAL_OPTS({
      user_emmet_mode = 'i',
      user_emmet_install_global = 0,
    })
  end,
}
