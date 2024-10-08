local statuscolumn = ""

return {
  "folke/zen-mode.nvim",
  cmd = "ZenMode",
  config = function()
    require("zen-mode").setup({
      window = {
        backdrop = 1,
        width = function()
          return math.min(120, GET_EDITOR_WIDTH() * 0.75)
        end,
        height = 0.9,
        options = {
          number = false,
          relativenumber = false,
          foldcolumn = "0",
          list = false,
          showbreak = "NONE",
        },
      },
      plugins = {
        options = {
          laststatus = 0,
        },
      },
      on_open = function()
        vim.diagnostic.enable(false)
        statuscolumn = vim.o.statuscolumn
        vim.o.statuscolumn = ""
      end,
      on_close = function()
        vim.diagnostic.enable()
        vim.o.statuscolumn = statuscolumn
      end,
    })
  end,
}
