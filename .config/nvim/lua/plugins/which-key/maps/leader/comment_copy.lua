return {
  ["<leader>c"] = { group = "Comment/Copy" },
  ["<leader>cm"] = { group = "Comment" },
  ["<leader>cml"] = { "<cmd>TodoQuickFix<cr>", desc = "Todo List" },
  ["<leader>cms"] = { "<cmd>TodoTelescope<cr>", desc = "Todo Search" },
  ["<leader>cmp"] = {
    function()
      require("todo-comments").jump_prev()
    end,
    desc = "Previous Todo",
  },
  ["<leader>cmn"] = {
    function()
      require("todo-comments").jump_next()
    end,
    desc = "Next Todo",
  },
  ["<leader>co"] = { group = "Copy" },
  ["<leader>coa"] = {
    "<cmd>let @+ = expand('%:p')<cr>",
    desc = "Copy file absolute path",
  },
  ["<leader>cor"] = {
    "<cmd>let @+ = expand('%')<cr>",
    desc = "Copy file relative path",
  },
}
