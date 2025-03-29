local mode = "n"

return {
  "mattn/emmet-vim",
  cmd = "EmmetInstall",
  keys = {
    {
      "<leader>cue",
      function()
        local bufnr = CUR_BUF()
        local var_key = CONSTS.EMMET_INSTALLED
        local is_installed = BUF_VAR(bufnr, var_key)
        if not is_installed then
          cmd.EmmetInstall()
          BUF_VAR(bufnr, var_key, true)
        end

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
