return {
  gcc = "Toggle line comment",
  ["]t"] = {
    "<cmd>lua require('todo-comments').jump_next()<cr>",
    "Next todo comment",
  },
  ["[t"] = {
    "<cmd>lua require('todo-comments').jump_prev()<cr>",
    "Previous todo comment",
  },
}
