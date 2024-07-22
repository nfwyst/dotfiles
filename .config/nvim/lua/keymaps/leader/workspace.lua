return {
  ["<leader>w"] = { group = "Workspace" },
  ["<leader>wc"] = { "<cmd>SetWorkspacePathCustom<cr>", desc = "Custom path" },
  ["<leader>wg"] = {
    "<cmd>SetWorkspacePathGlobal<cr>",
    desc = "Path to global",
  },
  ["<leader>wl"] = {
    "<cmd>SetWorkspacePathLocal<cr>",
    desc = "Path to local",
  },
  ["<leader>wp"] = {
    "<cmd>ShowWorkspacePath<cr>",
    desc = "Preview workspace path",
  },
  ["<leader>wS"] = { "<cmd>wa!<cr>", desc = "Save all content" },
  ["<leader>wd"] = {
    "<cmd>lua require('telescope.builtin').diagnostics({ root_dir = cwd })<cr>",
    desc = "Workspace Diagnostics",
  },
  ["<leader>ws"] = { "<cmd>WorkspaceSymbols<cr>", desc = "Workspace Symbols" },
}
