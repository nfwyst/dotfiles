return {
  "nvzone/typr",
  cmd = { "Typr", "TyprStats" },
  dependencies = { "nvzone/volt" },
  keys = {
    { "<leader>cuk", "", desc = "keyboard practice" },
    { "<leader>cukt", "<cmd>Typr<cr>", desc = "Typr: Typing Practice" },
    { "<leader>cuks", "<cmd>TyprStats<cr>", desc = "Typr: Typing Status" },
  },
  opts = function()
    require("typr.state").linecount = 3

    return {
      numbers = true,
      symbols = true,
      on_attach = function(bufnr)
        BUF_VAR(bufnr, "minipairs_disable", true)
      end,
    }
  end,
}
