return {
  "mattn/emmet-vim",
  cmd = "EmmetInstall",
  keys = {
    { "<leader>cue", "", desc = "emmet" },
    { "<leader>cuee", "<cmd>EmmetInstall<cr>", desc = "Enable Emmet" },
    { "<leader>cueg", "<Plug>(emmet-expand-abbr)", desc = "Emmet Generate" },
  },
  config = function()
    SET_OPTS({
      user_emmet_mode = "n",
      user_emmet_install_global = 0,
    }, "g")
  end,
}
