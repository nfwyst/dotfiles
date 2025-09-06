return {
  "mattn/emmet-vim",
  cmd = "EmmetInstall",
  keys = {
    {
      "<leader>cUe",
      function()
        vim.cmd.EmmetInstall()
        vim.fn["emmet#expandAbbr"](3, "")
      end,
      desc = "Expand Emmet",
    },
  },
  config = function()
    vim.g.user_emmet_mode = "n"
    vim.g.user_emmet_install_global = 0
  end,
}
