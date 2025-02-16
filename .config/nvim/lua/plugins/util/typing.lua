return {
  "nvzone/typr",
  cond = not IS_LINUX,
  cmd = { "Typr", "TyprStats" },
  dependencies = "nvzone/volt",
  keys = {
    { "<leader>cut", "<cmd>Typr<cr>", desc = "Typr: Typing Practice" },
    { "<leader>cus", "<cmd>TyprStats<cr>", desc = "Typr: Typing Status" },
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
