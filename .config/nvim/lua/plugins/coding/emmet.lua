local mode = "n"

return {
  "mattn/emmet-vim",
  cmd = "EmmetInstall",
  keys = {
    {
      "<leader>cue",
      function()
        cmd.EmmetInstall()
        PRESS_KEYS("<Plug>(emmet-expand-abbr)", mode)
      end,
      desc = "Expand Emmet",
    },
  },
  config = function()
    SET_OPTS({
      user_emmet_mode = mode,
      user_emmet_install_global = 0,
    }, "g")
  end,
}
