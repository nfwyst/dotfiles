return {
  "kawre/leetcode.nvim",
  lazy = true,
  dependencies = {
    "nvim-telescope/telescope.nvim",
    "MunifTanjim/nui.nvim",
  },
  config = function()
    require("leetcode").setup({
      lang = "typescript",
      logging = false,
      cn = {
        enabled = true,
      },
    })
  end,
}
