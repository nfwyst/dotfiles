return {
  "kawre/leetcode.nvim",
  cmd = { "Leet" },
  dependencies = {
    "nvim-telescope/telescope.nvim",
    "MunifTanjim/nui.nvim",
  },
  config = function()
    IS_LEETING = true
    require("leetcode").setup({
      lang = "typescript",
      logging = false,
      cn = {
        enabled = true,
      },
    })
  end,
}
