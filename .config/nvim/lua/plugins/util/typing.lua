return {
  "nvzone/typr",
  cmd = { "Typr", "TyprStats" },
  dependencies = { "nvzone/volt" },
  keys = {
    { "<leader>cUk", "", desc = "keyboard practice" },
    { "<leader>cUkt", "<cmd>Typr<cr>", desc = "Typr: Typing Practice" },
    { "<leader>cUks", "<cmd>TyprStats<cr>", desc = "Typr: Typing Status" },
  },
  opts = function()
    require("typr.state").linecount = 3

    return {
      numbers = true,
      symbols = true,
      on_attach = function(bufnr)
        vim.api.nvim_buf_set_var(bufnr, "minipairs_disable", true)
      end,
    }
  end,
}
