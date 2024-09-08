return {
  ["<leader>a"] = { group = "AI/AST" },
  ["<leader>ai"] = { group = "AI" },
  ["<leader>as"] = { group = "AST" },
  ["<leader>aig"] = { group = "GPT prompt" },
  ["<leader>aia"] = { group = "Avante" },
  ["<leader>aigc"] = { "<cmd>GpPickCommand<cr>", desc = "GPT select command" },
  ["<leader>aiga"] = { "<cmd>GpSelectAgent<cr>", desc = "GPT select agent" },
  ["<leader>asc"] = { "<cmd>TSContextToggle<cr>", desc = "Toggle code context" },
  ["<leader>ase"] = { "<cmd>EditQuery<cr>", desc = "Show live query editor" },
  ["<leader>ash"] = {
    "<cmd>Inspect<cr>",
    desc = "Highlight groups under the cursor",
  },
  ["<leader>ass"] = { "<cmd>TSUpdateSync<cr>", desc = "Update language sync" },
  ["<leader>ast"] = { "<cmd>InspectTree<cr>", desc = "Show syntax tree" },
  ["<leader>asu"] = { "<cmd>TSUpdate<cr>", desc = "Update language" },
}
